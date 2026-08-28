import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CreateComplaintRequest,
  ResolveComplaintRequest,
} from "@titlepipe/contract";
import { post } from "../../shared/api";
import { notify } from "../../shared/notify";

/**
 * THE TWO WRITES THE COMPLAINT LOOP HAS, AND THE LATCH THAT KEEPS EACH ACT ONE
 * RECORD.
 *
 * ══ THE REQUEST TYPES ARE THE CONTRACT'S ═══════════════════════════════════
 *
 * `ResolveComplaintRequest` (endpoints.ts:558) makes `rule` a REQUIRED union of
 * exactly two arms — cite an id, or supply a draft. So the refusal
 * `endpoints.ts:548` states in prose ("the complaint loop terminates in a rule
 * … REFUSED without a rule") is a TYPE ERROR here before it is a 422 at
 * handlers.ts:1057. Both layers on purpose: the server is the enforcement, and
 * this is the thing that stops the wrong request being written.
 *
 * ══ ONE ACT, ONE RECORD (`INVARIANTS:20-21`) ═══════════════════════════════
 *
 * "Three clicks on a correction submit file exactly one correction — including
 * three clicks within a single tick." `isPending` alone does NOT satisfy that:
 * it is React state, so three synchronous presses all read the value from
 * before the first render and all three call `mutate`. The `useRef` latch is
 * the half that holds inside one tick; the disabled button is the half the
 * reader can see. Neither is redundant.
 *
 * The dropped second and third presses are not an unspoken refusal
 * (`INVARIANTS:12`) — they are the SAME act, and the control already carries
 * the sentence that says the server has not answered yet.
 *
 * ══ NO OPTIMISTIC ANYTHING ═════════════════════════════════════════════════
 *
 * `INVARIANTS:4`. On success the queries are invalidated and the SERVER's rows
 * repaint. `["rules"]` goes with `["complaints"]` because resolving may MINT a
 * rule (handlers.ts:1072, origin `complaint`) and that rule lands `pending` —
 * a status only the server can state (`INVARIANTS:38`). Painting the draft as
 * hoped is how a pending rule gets shown as live.
 *
 * ══ THE REFUSAL IS THE SERVER'S SENTENCE ═══════════════════════════════════
 *
 * `INVARIANTS:14`, and `INVARIANTS:16` for the 409 this endpoint really does
 * return ("already resolved", handlers.ts:1061). `shared/api.ts` puts the
 * server's message verbatim on the `ApiError`; `onError` hands that string to
 * `notify.error` unaltered. Nothing here composes refusal text, and nothing
 * swallows a status.
 */

/**
 * The mock's `{ ok: true }` acknowledgement, as a structural validator rather
 * than a zod schema — `shared/api.ts` takes `Validator<T>` and this app never
 * imports zod into the browser bundle. The body carries no state; the
 * invalidated queries do.
 */
const OkResponse = {
  safeParse: (input: unknown) =>
    ({ success: true, data: input }) as { success: true; data: unknown },
};

/** `POST /api/complaints` — a client names a defect in a delivered report. */
export function useRecordComplaint() {
  const client = useQueryClient();
  const inFlight = useRef(false);
  const mutation = useMutation({
    mutationFn: (body: CreateComplaintRequest) =>
      post("/api/complaints", OkResponse, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["complaints"] }),
    onError: (error: Error) => notify.error(error.message),
    onSettled: () => {
      inFlight.current = false;
    },
  });

  return {
    pending: mutation.isPending,
    submit(body: CreateComplaintRequest, onDone: () => void) {
      if (inFlight.current) return;
      inFlight.current = true;
      mutation.mutate(body, { onSuccess: onDone });
    },
  };
}

/**
 * `POST /api/complaints/{id}/resolve` — REFUSED without a rule.
 *
 * The id travels in the URL and is passed per call rather than bound at hook
 * construction, because the screen holds a selection that changes under a hook
 * that must not be re-created: a hook keyed to the selected complaint drops its
 * in-flight latch every time the reader clicks a different row.
 */
export function useResolveComplaint() {
  const client = useQueryClient();
  const inFlight = useRef(false);
  const mutation = useMutation({
    mutationFn: (args: { id: string; body: ResolveComplaintRequest }) =>
      post(`/api/complaints/${args.id}/resolve`, OkResponse, args.body),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["complaints"] }),
        client.invalidateQueries({ queryKey: ["rules"] }),
      ]);
    },
    onError: (error: Error) => notify.error(error.message),
    onSettled: () => {
      inFlight.current = false;
    },
  });

  return {
    pending: mutation.isPending,
    submit(id: string, body: ResolveComplaintRequest, onDone: () => void) {
      if (inFlight.current) return;
      inFlight.current = true;
      mutation.mutate({ id, body }, { onSuccess: onDone });
    },
  };
}
