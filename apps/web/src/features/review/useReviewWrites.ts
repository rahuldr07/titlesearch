import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Ack, PassOrderResponse } from "@titlepipe/contract";
import { post } from "../../shared/api";
import { orderFields, orderTimeline } from "../../shared/queries";

/**
 * The five review mutations, shaped by one rule: the server's message
 * surfaces verbatim, selection never advances on a refusal, and the field
 * repaints as the server has it.
 */

export function useReviewWrites(orderId: string) {
  const client = useQueryClient();

  /**
   * The server's last word, or null. Rendered verbatim by the decision
   * panel and held until the next act rather than shown as a toast that
   * disappears — the screen, not the toast, carries the durable state.
   */
  const [serverNote, setServerNote] = useState<string | null>(null);

  /** The synchronous duplicate-guard latch — this cannot be state. */
  const inFlight = useRef(false);

  const repaint = useCallback(() => {
    void client.invalidateQueries({ queryKey: orderFields(orderId).key });
    /* The hub's event trail is live, and every act here is an event the
       server records. A re-read, never an optimistic append: the trail
       moves only when the server says it has. */
    void client.invalidateQueries({ queryKey: orderTimeline(orderId).key });
  }, [client, orderId]);

  /**
   * Whether an act is in flight, for rendering only. The duplicate guard
   * is the ref above and must stay the ref: state updates land after the
   * tick, so three clicks in one tick would all pass a state check.
   */
  const [pending, setPending] = useState(false);

  /**
   * Run one act. `after` is what success does — advancing selection,
   * closing an editor — and it is never reached on a refusal, which is how
   * "selection never advances" holds without every call site remembering
   * it.
   */
  const act = useCallback(
    (run: () => Promise<unknown>, after?: () => void) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setPending(true);
      setServerNote(null);
      run()
        .then(() => after?.())
        // Verbatim. `api.ts` already put the server's sentence on `message`.
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
      act(
        () => post(`/api/orders/${orderId}/pass`, PassOrderResponse, { reason }),
        after,
      ),
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
