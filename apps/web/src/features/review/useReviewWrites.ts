import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Ack, PassOrderResponse } from "@titlepipe/contract";
import { post } from "../../shared/api";
import { orderFields } from "../../shared/queries";

/**
 * THE FIVE REVIEW MUTATIONS, AND THE TWO RULES THAT SHAPE ALL OF THEM.
 *
 * ══ RULE 1: A 409 IS AN ANSWER (INVARIANTS 16-17) ══════════════════════════
 *
 * "The server's message surfaces VERBATIM, selection NEVER advances, and the
 * field repaints as the server has it." All three halves are here:
 *
 *   - VERBATIM — the refusal is `error.message`, which `api.ts` filled from the
 *     server's `{ error }` body and nothing has touched since. No prefix, no
 *     "Error:", no client-authored fallback sentence. `notify.ts` records the
 *     same rule: "if you find yourself wanting to improve the server's
 *     sentence, the improvement belongs in the server."
 *   - NEVER ADVANCES — advancing is the SUCCESS path's job and lives in
 *     `onSuccess`. A failure simply does not call it. This is why the advance
 *     is a callback passed per-act rather than something the screen does after
 *     `mutate()` returns: `mutate` is fire-and-forget and returns immediately,
 *     so a screen that advanced on the next line would advance on refusals too.
 *     `review-refusals.spec` pins exactly that, four times.
 *   - REPAINTS AS THE SERVER HAS IT — every settled mutation, refused or not,
 *     invalidates the fields query. Refused included, deliberately: a 409 on a
 *     terminal field means the server knows something this client does not, and
 *     re-reading is how the row stops showing the stale answer.
 *
 * There is NO optimistic update anywhere in this file (INVARIANT 4), and no
 * retry (`api.ts`: "NO RETRY ON MUTATIONS"). A retried correction is two
 * correction records for one reviewer act.
 *
 * ══ RULE 2: ONE ACT FILES ONE RECORD (INVARIANTS 20-21) ════════════════════
 *
 * "Three clicks on a correction submit file EXACTLY ONE correction — including
 * three clicks within a single tick." The last clause is what makes this a ref
 * and not a piece of state.
 *
 * `isPending` is READ AT RENDER TIME. Three synchronous clicks dispatched from
 * one `page.evaluate` give React no chance to re-render between them, so a
 * guard on `isPending` sees the same stale `false` three times and files three
 * records — deterministically, on any machine. `review-refusals.spec` dispatches
 * exactly that and says why: "only a synchronous latch survives this".
 *
 * So the latch is a ref, set BEFORE the request leaves and cleared in
 * `onSettled`. A ref mutation is visible to the very next statement, which is
 * the only property that matters here.
 */

export type ReviewWrites = ReturnType<typeof useReviewWrites>;

export function useReviewWrites(orderId: string) {
  const client = useQueryClient();

  /**
   * The server's last word, or null. Rendered verbatim by the decision panel
   * (`confirm-note`) and held until the next act rather than shown as a toast
   * that disappears — `notify.ts`: "the SCREEN, not the toast, carries the
   * durable state of a refused action".
   */
  const [serverNote, setServerNote] = useState<string | null>(null);

  /** The synchronous latch. See rule 2 above — this cannot be state. */
  const inFlight = useRef(false);

  const repaint = useCallback(() => {
    void client.invalidateQueries({ queryKey: orderFields(orderId).key });
  }, [client, orderId]);

  /**
   * Wrap a mutation so it obeys both rules without each call site remembering
   * to. `run` is the request; `after` is what SUCCESS does — advancing
   * selection, closing an editor — and it is never called on a refusal.
   */
  /**
   * Whether an act is in flight, FOR RENDERING ONLY. The duplicate guard is the
   * ref above and must stay the ref: this is state, it is read at render time,
   * and `review-refusals.spec` dispatches three clicks in one tick precisely to
   * prove a render-time guard loses that race.
   */
  const [pending, setPending] = useState(false);

  /**
   * Run one act. `after` is what SUCCESS does — advancing selection, closing an
   * editor — and it is never reached on a refusal, which is how "selection
   * never advances" holds without every call site remembering it.
   */
  const act = useCallback(
    (run: () => Promise<unknown>, after?: () => void) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setPending(true);
      setServerNote(null);
      run()
        .then(() => after?.())
        // VERBATIM. `api.ts` already put the server's sentence on `message`.
        .catch((error: Error) => setServerNote(error.message))
        .finally(() => {
          inFlight.current = false;
          setPending(false);
          repaint();
        });
    },
    [repaint],
  );

  const confirm = useCallback(
    (fieldId: string, value: string | null, after?: () => void) =>
      act(() => post(`/api/fields/${fieldId}/confirm`, Ack, { value }), after),
    [act],
  );

  const correct = useCallback(
    (
      fieldId: string,
      body: { value: string | null; reason: string; na_reason?: string | null },
      after?: () => void,
    ) => act(() => post(`/api/fields/${fieldId}/correct`, Ack, body), after),
    [act],
  );

  const escalate = useCallback(
    (fieldId: string, question: string, after?: () => void) =>
      act(() => post(`/api/fields/${fieldId}/escalate`, Ack, { question }), after),
    [act],
  );

  const exclude = useCallback(
    (fieldId: string, reason: string, after?: () => void) =>
      act(() => post(`/api/fields/${fieldId}/exclude`, Ack, { reason }), after),
    [act],
  );

  const pass = useCallback(
    (reason: string, after?: () => void) =>
      act(() => post(`/api/orders/${orderId}/pass`, PassOrderResponse, { reason }), after),
    [act, orderId],
  );

  return {
    serverNote,
    clearNote: useCallback(() => setServerNote(null), []),
    pending,
    confirm,
    correct,
    escalate,
    exclude,
    pass,
  };
}
