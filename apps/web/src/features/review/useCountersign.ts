import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Countersign } from "@titlepipe/contract";
import { post } from "../../shared/api";
import { countersigns } from "../../shared/countersignQueries";
import { orderTimeline } from "../../shared/queries";

/**
 * One countersign, filed once. "A second read must come from a different
 * examiner than the one who ruled" is the server's 409, never button state,
 * so nothing here inspects who is signed in before posting. The refusal
 * renders verbatim.
 */
export function useCountersign(orderId: string) {
  const client = useQueryClient();
  const [serverNote, setServerNote] = useState<string | null>(null);

  /** For rendering only. The duplicate guard is the ref — see `act`. */
  const [pending, setPending] = useState(false);

  /*
   * The synchronous latch, and it cannot be `pending`: state is read at
   * render time, so three clicks dispatched in one tick all see `false` and
   * file three records. A ref closes on the first click.
   */
  const inFlight = useRef(false);

  const countersign = useCallback(
    (fieldId: string, signature: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setPending(true);
      setServerNote(null);
      // `Countersign` is the contract's record for this act; a shape that does
      // not match it surfaces as a refusal rather than reaching the panel.
      post(`/api/fields/${fieldId}/countersign`, Countersign, { signature })
        .catch((error: Error) => setServerNote(error.message))
        .finally(() => {
          inFlight.current = false;
          setPending(false);
          // The list repaints from the server: `countersigned_by` is its word.
          void client.invalidateQueries({ queryKey: countersigns(orderId).key });
          // A countersign is an event the trail appends — by re-reading the
          // server's timeline, never by an optimistic append.
          void client.invalidateQueries({ queryKey: orderTimeline(orderId).key });
        });
    },
    [client, orderId],
  );

  return {
    serverNote,
    pending,
    countersign,
    clearNote: useCallback(() => setServerNote(null), []),
  };
}
