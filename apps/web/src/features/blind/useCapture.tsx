import { useMutation } from "@tanstack/react-query";
import { BlindEntriesResponse, type BlindEntriesRequest } from "@titlepipe/contract";
import { post } from "../../shared/api";
import { blindEntriesPath } from "../../shared/blindQueries";
import { notify } from "../../shared/notify";

/**
 * The seat's one mutation, and its only write. Nothing is invalidated: no read
 * of blind entries exists by design, so the accepted `entry_ids` are the whole
 * record the seat is shown. The submit control is disabled while `isPending`,
 * so one act files one record (INVARIANT 20/21). The refusal is the server's
 * sentence, uncomposed (INVARIANT 14/16).
 */
export function useCapture(order: string, onAccepted: () => void) {
  return useMutation({
    mutationFn: (body: BlindEntriesRequest) =>
      post(blindEntriesPath(order), BlindEntriesResponse, body),
    onSuccess: onAccepted,
    onError: (error: Error) => {
      notify.error(error.message);
    },
  });
}
