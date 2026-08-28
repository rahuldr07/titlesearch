import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Countersign } from "@titlepipe/contract";
import { post } from "../../shared/api";
import { countersigns } from "../../shared/countersignQueries";

/**
 * ONE COUNTERSIGN, FILED ONCE.
 *
 * Design rule 13 — a second read must come from a different examiner than the
 * one who ruled — is the SERVER's 409, never button state, so nothing here
 * inspects who is signed in before posting. The refusal is rendered verbatim.
 */
export function useCountersign(orderId: string) {
  const client = useQueryClient();
  const [serverNote, setServerNote] = useState<string | null>(null);

  /** For rendering only. The duplicate guard is the ref — see `act`. */
  const [pending, setPending] = useState(false);

  /*
   * THE SYNCHRONOUS LATCH, and it cannot be `pending`. State is read at render
   * time, so three clicks dispatched in one tick all see `false` and file three
   * records. A ref is written before the await and closes on the first click.
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
