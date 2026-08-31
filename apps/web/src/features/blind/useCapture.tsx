import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { BlindEntriesResponse, type BlindEntriesRequest } from "@titlepipe/contract";
import { post } from "../../shared/api";
import { blindEntriesPath } from "../../shared/blindQueries";
import { notify } from "../../shared/notify";

/**
 * The seat's one mutation, and its only write. Nothing is invalidated: no
 * read of blind entries exists by design, so the accepted `entry_ids` are
 * the whole record the seat is shown. The refusal is the server's sentence,
 * uncomposed.
 *
 * One act files one record, and a disabled control does not enforce it:
 * `isPending` is state read at render, so three clicks in one tick all read
 * `false` and all three post. The latch is a ref, set before the request
 * leaves and cleared once the server has answered, so it is already closed
 * when the second click of the same tick reads it.
 */
export function useCapture(order: string, onAccepted: () => void) {
  const filing = useRef(false);

  const mutation = useMutation({
    mutationFn: (body: BlindEntriesRequest) =>
      post(blindEntriesPath(order), BlindEntriesResponse, body),
    onSuccess: onAccepted,
    onError: (error: Error) => {
      notify.error(error.message);
    },
    onSettled: () => {
      filing.current = false;
    },
  });

  return {
    error: mutation.error,
    data: mutation.data,
    isPending: mutation.isPending,
    file: (body: BlindEntriesRequest) => {
      if (filing.current) return;
      filing.current = true;
      mutation.mutate(body);
    },
  };
}
