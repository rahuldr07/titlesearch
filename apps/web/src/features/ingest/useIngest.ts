import { useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Ack, type IngestRejection, type Order } from "@titlepipe/contract";
import { post } from "../../shared/api";
import { RefusedError, uploadPackage } from "./uploadPackage";

/**
 * The one signed act of intake. The wire is still two server calls — the
 * create and the explicit accept — chained inside one mutation so the flow is
 * one press. `Ack` carries no state back; the server stays the only author of
 * the order's state.
 *
 * `isPending` is state read at render, so clicks in one tick all see the same
 * stale `false` and the extras 409 as duplicates of the order they created
 * themselves — the ref latch moves synchronously and drops them first.
 */
export function useSignForPackage(options: {
  readonly onSigned: (order: Order) => void;
  readonly onRefused: (rejection: IngestRejection) => void;
  readonly onFailed: (message: string) => void;
}) {
  const inFlight = useRef(false);
  const mutation = useMutation({
    mutationFn: async (form: FormData) => {
      const created = await uploadPackage(form);
      await post(`/api/orders/${created.order.id}/accept`, Ack);
      return created.order;
    },
    onSuccess: (order) => options.onSigned(order),
    onError: (error: Error) => {
      if (error instanceof RefusedError) options.onRefused(error.rejection);
      else options.onFailed(error.message);
    },
    onSettled: () => void (inFlight.current = false),
  });
  const { mutate } = mutation;
  const send = useCallback(
    (form: FormData) => {
      if (inFlight.current) return;
      inFlight.current = true;
      mutate(form);
    },
    [mutate],
  );
  return { send, pending: mutation.isPending };
}
