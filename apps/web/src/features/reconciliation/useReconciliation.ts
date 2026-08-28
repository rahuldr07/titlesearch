import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReconciliationRulingRequest } from "@titlepipe/contract";
import { post } from "../../shared/api";
import { notify } from "../../shared/notify";

/**
 * THE ONE WRITE THIS SCREEN HAS, AND THE LATCH THAT KEEPS ONE ACT ONE RECORD.
 *
 * ══ THE REQUEST TYPE IS THE CONTRACT'S ═════════════════════════════════════
 *
 * `ReconciliationRulingRequest` (endpoints.ts:349) types `citation` as
 * `z.string().min(1)` — REQUIRED. So "a ruling with no source is an opinion"
 * (:345) is a schema failure at handlers.ts:1295 before it is anything else,
 * and the request is typed against the contract's own shape rather than a local
 * one so a ruling that omits the citation does not compile here either.
 *
 * `general_rule_draft` is OPTIONAL and is sent only when the senior offers one.
 * `endpoints.ts:347`: "never pre-selected by the UI" — so the key is absent
 * rather than present-and-empty, because an empty draft object is an offer the
 * senior did not make.
 *
 * ══ ONE ACT, ONE RECORD (`INVARIANTS:20-21`) ═══════════════════════════════
 *
 * `isPending` alone does not satisfy it: it is React state, so three
 * synchronous presses all read the value from before the first render and all
 * three call `mutate`. The `useRef` latch is the half that holds INSIDE one
 * tick; the disabled button is the half the reader can see. The dropped second
 * and third presses are the same act, and the control already carries the
 * sentence saying the server has not answered — so this is not the unspoken
 * no-op `INVARIANTS:12` forbids.
 *
 * ══ NO OPTIMISTIC ANYTHING, AND THE 409 IS AN ANSWER ═══════════════════════
 *
 * `INVARIANTS:4`: on success the query is invalidated and the SERVER's rows
 * repaint — `ruled_by` and `general_rule_id` are the server's to write
 * (handlers.ts:1302-1306) and are not guessed here.
 *
 * `INVARIANTS:16` and `19`: this endpoint 409s a second ruling on the same path
 * ("already ruled", handlers.ts:1300) because a replayed resolution is REFUSED,
 * not idempotent. `shared/api.ts` puts the server's message verbatim on the
 * `ApiError` and `onError` hands that exact string to `notify.error`. Nothing
 * swallows the status, nothing composes the sentence, and the selection does
 * NOT advance — the screen keeps the divergence the reader is looking at,
 * because `submit` moves nothing and only the success callback is given a way
 * to reset the form.
 */

/** The mock's `{ ok: true }`, as a structural validator — no zod in the bundle. */
const OkResponse = {
  safeParse: (input: unknown) =>
    ({ success: true, data: input }) as { success: true; data: unknown },
};

export function useRuleDivergence(orderId: string) {
  const client = useQueryClient();
  const inFlight = useRef(false);
  const mutation = useMutation({
    mutationFn: (body: ReconciliationRulingRequest) =>
      post(`/api/reconciliation/${orderId}`, OkResponse, body),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["reconciliation", orderId] }),
        // A ruling may MINT a rule (handlers.ts:1308, origin `reconciliation`)
        // and it lands `pending` — a status only the server can state.
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
    submit(body: ReconciliationRulingRequest, onDone: () => void) {
      if (inFlight.current) return;
      inFlight.current = true;
      mutation.mutate(body, { onSuccess: onDone });
    },
  };
}
