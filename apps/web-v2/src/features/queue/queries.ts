import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { QueueBandsResponse, QueueNextResponse, PassOrderResponse } from "@titlepipe/contract";
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
 * The four bands — Mine, Held, In flight, Recently delivered — as a CENSUS, not
 * as a browse endpoint. Nothing on a band row carries a claim token, an
 * assignment or an ordering the caller can influence, so `/api/queue/next`
 * stays the only hand-over by construction rather than by this screen's
 * restraint (`queue.spec` #1).
 *
 * WHICH bands come back is the server's answer to "what may this caller see":
 * a reviewer is served no `in_flight` band at all rather than an empty one. The
 * screen therefore renders the bands it was given and never a fixed four.
 *
 * Separate from `nextOrderQuery` deliberately. A pass invalidates the next
 * order; it does not invalidate the census, and coupling the two would make
 * every pass redraw four bands that did not change.
 *
 * Keyed on the acting role, the same way `myPermissionsQuery` is: the server
 * narrows both WHICH bands come back and WHICH rows are in them, so a role
 * switch that served a cached world would show one role's held orders under
 * another's name. A stale world is worse than no world.
 */
export function queueBandsQuery(role: string) {
  return queryOptions({
    queryKey: ["queue", "bands", role],
    queryFn: () => get("/api/queue/bands", QueueBandsResponse),
  });
}

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
