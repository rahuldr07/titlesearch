import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { QueueNextResponse, PassOrderResponse } from "@titlepipe/contract";
import { get, post } from "../../shared/api";

/**
 * The queue's data. `GET /api/queue/next` serves ONE order — there is no
 * browse or pick endpoint, deliberately (CONTEXT §7), and `queue.spec` #1
 * asserts the second queued order appears nowhere on the page.
 *
 * `queryOptions` rather than a bespoke hook so the same descriptor can be
 * prefetched from a route loader later without duplicating the key.
 */
export const nextOrderQuery = queryOptions({
  queryKey: ["queue", "next"],
  queryFn: () => get("/api/queue/next", QueueNextResponse),
});

/**
 * A pass is REFUSED without a reason. The refusal is enforced server-side —
 * `PassOrderRequest` requires `reason: z.string().min(1)` and the mock returns
 * 422 — and the UI simply does not send an empty one. That ordering matters:
 * §9.14 says the client is a mirror, never the authority.
 *
 * The response is a bare ack. Pass counts and the fourth-pass auto-escalation
 * live on the server and never come back, so there is nothing here to render
 * a counter from even if someone wanted one.
 */
export function usePassOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      post(`/api/orders/${orderId}/pass`, PassOrderResponse, { reason }),
    // Refetch rather than advance a local pointer: the server decides which
    // order comes next, and guessing here would be exactly the client-side
    // queue logic constraint 8 forbids.
    onSuccess: () => client.invalidateQueries({ queryKey: ["queue", "next"] }),
  });
}
