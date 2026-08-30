import { useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Ack, type IngestRejection, type Order } from "@titlepipe/contract";
import { post } from "../../shared/api";
import { RefusedError, uploadPackage } from "./uploadPackage";

/**
 * THE ONE SIGNED ACT OF INTAKE.
 *
 * ⚠ RULED 2026-08-29 (`docs/frontend/design-2026-08/RULING-2026-08-29.md`):
 * the reference draws ONE press — "Sign for Package & Begin Dual-Engine
 * Extraction →" — and the ruling supersedes the two-act split this hook used
 * to enforce under INVARIANT 47. The wire is unchanged: the create
 * (`POST /api/orders`) and the explicit accept (`POST /orders/{id}/accept`)
 * are still two server calls, chained INSIDE one mutation so the drawn flow
 * is one act. `Ack` carries no state back — the server stays the only author
 * of the order's state.
 *
 * ONE ACT FILES ONE RECORD, AND `isPending` CANNOT ENFORCE IT. Measured before
 * the `inFlight` latch existed: three synchronous clicks filed THREE requests,
 * because `isPending` is state read at render and three clicks in one tick all
 * see the same stale `false`. Here the extras 409 as duplicates of the order
 * they created themselves. The ref moves synchronously, so the rest are
 * dropped before they leave. Same shape as `useReviewWrites` and `ReleaseAct`.
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
