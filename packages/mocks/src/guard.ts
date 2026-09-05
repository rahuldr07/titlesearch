import { HttpResponse } from "msw";
import { canDo, isRole, SEAT_IDENTITIES, type Action, type Role } from "@titlepipe/contract";

export const err = (message: string, status: number) =>
  HttpResponse.json({ error: message }, { status });

/** The only credential the mock phase has. One name, spelled once. */
export const MOCK_ROLE_HEADER = "x-mock-role";

/** An authenticated caller: the role they hold and the identity it resolves to. */
export interface Seat {
  readonly role: Role;
  readonly actor: string;
}

/**
 * The acting seat, or null when the request presented no usable credential.
 *
 * A MISSING header is not a session. It used to mean `admin`, which made
 * sending nothing strictly more powerful than sending anything — a typist
 * was refused `golden.correct` while a caller with no header at all was
 * granted it. Since core-api ships no mutating product route, these handlers
 * are what the running application talks to, so that was the app's live
 * authorization posture and not a fixture curiosity.
 *
 * The identity is READ OFF the credential, never off the request body or a
 * second header. That is the whole of FX-28's fix: there is no wire input
 * that names a person, so `corrected_by` cannot be chosen by the caller.
 */
export const seatOf = (request: Request): Seat | null => {
  const raw = request.headers.get(MOCK_ROLE_HEADER);
  if (!isRole(raw)) return null;
  return { role: raw, actor: SEAT_IDENTITIES[raw] };
};

/**
 * Role gate on every mutation, standing in for core-api middleware. Runs
 * before body validation: a role lacking the action gets 403 even with an
 * invalid body. Its own module because `handlers.ts` imports `design.ts`,
 * so the two handler files cannot import the gate from each other.
 *
 * Two refusals, deliberately distinct. No credential is 401 — `require_seat`
 * in core-api answers an unauthenticated request the same way, and the mock
 * must not teach the UI a posture the real server does not hold. A credential
 * that is present but unknown, or known and insufficient, is 403: the caller
 * IS someone, and what they are told is that this seat may not do this.
 */
export const guard = (request: Request, action: Action) => {
  if (request.headers.get(MOCK_ROLE_HEADER) === null) {
    return err("refused: no session — every act is signed, so every act needs a seat", 401);
  }
  const seat = seatOf(request);
  if (seat !== null && canDo(seat.role, action)) return null;
  return err(`refused: role lacks ${action}`, 403);
};

/**
 * The gate for handlers that also need the signer.
 *
 * Same refusals as `guard`, but it hands back the seat on the way through,
 * so a handler cannot learn WHO is acting without having proved they MAY
 * act. That ordering is the point: an identity obtained before the gate is
 * an identity available to a caller the gate would have refused.
 */
export const guardAs = (
  request: Request,
  action: Action,
): { denied: Response; seat: null } | { denied: null; seat: Seat } => {
  const denied = guard(request, action);
  const seat = seatOf(request);
  // `guard` returning null means `seatOf` found a seat; the check keeps that
  // a fact the type system holds rather than a comment.
  if (denied !== null || seat === null) {
    return { denied: denied ?? err("refused: no session", 401), seat: null };
  }
  return { denied: null, seat };
};
