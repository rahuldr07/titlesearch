import { HttpResponse } from "msw";
import { canDo, isRole, type Action } from "@titlepipe/contract";

export const err = (message: string, status: number) =>
  HttpResponse.json({ error: message }, { status });

/**
 * Role gate on every mutation, standing in for core-api middleware. Runs
 * before body validation: a role lacking the action gets 403 even with an
 * invalid body. Its own module because `handlers.ts` imports `design.ts`,
 * so the two handler files cannot import the gate from each other.
 */
export const guard = (request: Request, action: Action) => {
  const raw = request.headers.get("x-mock-role");
  const role = raw === null ? "admin" : isRole(raw) ? raw : null;
  if (role !== null && canDo(role, action)) return null;
  return err(`refused: role lacks ${action}`, 403);
};
