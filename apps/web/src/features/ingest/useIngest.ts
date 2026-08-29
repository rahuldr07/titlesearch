import { useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Ack, type IngestRejection, type Order } from "@titlepipe/contract";
import { post } from "../../shared/api";
import { RefusedError, uploadPackage } from "./uploadPackage";

/**
 * THE TWO ACTS OF INTAKE, AND THEY ARE TWO ON PURPOSE.
 *
 * INVARIANT 47 (`docs/INVARIANTS.md:131`): "Acceptance is explicit — an upload
 * alone never queues an order." The design draws ONE "Sign" button and
 * `ANALYSIS-screens.md` §7 conversation 3 records that as blurring the two
 * acts. So there are two mutations here, they are never chained, and no
 * `onSuccess` on the first calls the second.
 *
 * ONE ACT FILES ONE RECORD, AND `isPending` CANNOT ENFORCE IT. Measured before
 * the `inFlight` latch existed: three synchronous clicks on either control
 * filed THREE requests, because `isPending` is state read at render and three
 * clicks in one tick all see the same stale `false`. On intake the extras are
 * not merely wasteful — uploads two and three return 409 "duplicate package
 * (sha256 match)" and the screen prints the server's duplicate notice
 * (INVARIANTS:132) for a duplicate it created itself; accept filed three
 * signatures for one signing. The ref moves synchronously, so the rest are
 * dropped before they leave. Same shape as `useReviewWrites` and `ReleaseAct`.
 */
export function useUploadPackage(options: {
  readonly onUploaded: (order: Order) => void;
  readonly onRefused: (rejection: IngestRejection) => void;
  readonly onFailed: (message: string) => void;
}) {
  const inFlight = useRef(false);
  const mutation = useMutation({
    mutationFn: uploadPackage,
    onSuccess: (data) => options.onUploaded(data.order),
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

/**
 * The second act. A named person signs for the package; nothing reaches a
 * reviewer until they do. `Ack` (endpoints.ts:34) carries no state back — the
 * server stays the only author of the order's state.
 *
 * THE SIGNATURE IS THE SERVER'S: this call has no body (endpoints.ts:60), the
 * actor coming off the guarded session (handlers.ts:491). The design's
 * "Examiner signature: D. Okafor (#GA-8841)" is therefore refused, not
 * deferred — the only name this client holds is the unpersisted demo session,
 * which `signedIn.ts:22-24` restricts to the route guard, the sign-in screen
 * and the profile block, and which would disagree with the server's on any
 * divergence.
 */
export function useAcceptOrder(options: {
  readonly onAccepted: (order: Order) => void;
  readonly onFailed: (message: string) => void;
}) {
  const inFlight = useRef(false);
  const mutation = useMutation({
    mutationFn: (order: Order) => post(`/api/orders/${order.id}/accept`, Ack),
    onSuccess: (_ack, order) => options.onAccepted(order),
    onError: (error: Error) => options.onFailed(error.message),
    onSettled: () => void (inFlight.current = false),
  });
  const { mutate } = mutation;
  const send = useCallback(
    (order: Order) => {
      if (inFlight.current) return;
      inFlight.current = true;
      mutate(order);
    },
    [mutate],
  );
  return { send, pending: mutation.isPending };
}
