import { queryOptions } from "@tanstack/react-query";
import { DeliveriesResponse, OrderContextResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";

/**
 * The deliveries list, parsed at the boundary like every other response.
 *
 * Declared here rather than imported from `features/delivery` because a
 * cross-feature import is a build failure (§7) — features share through
 * `shared/` and `entities/`, not through each other. The key is deliberately
 * the SAME `["deliveries"]` the list screen uses: two keys for one resource
 * would let the confirmation screen and the delivery list disagree about
 * whether a retry landed, which is exactly the kind of split-brain the shared
 * cache exists to prevent.
 */
export const deliveriesQuery = queryOptions({
  queryKey: ["deliveries"],
  queryFn: () => get("/api/deliveries", DeliveriesResponse),
});

/**
 * WHAT WAS ORDERED, from the order rather than from this file (2026-07-30,
 * Wave 2). A delivery record carries id / method / status / timestamps and the
 * report's order id and version — nothing about the product or the period the
 * sheet itself claims to state. Both were private constants here for want of a
 * carrier, and a delivery confirmation that cannot name the product is
 * confirming an unnamed thing. `GET /api/orders/{id}/context` names it, and
 * the human ref with it.
 *
 * Same `["orders", id, "context"]` key the top strip reads, deliberately: two
 * keys for one resource is how two parts of a screen end up naming one order
 * two different ways.
 */
export function orderContextQuery(orderId: string) {
  return queryOptions({
    queryKey: ["orders", orderId, "context"],
    queryFn: () => get(`/api/orders/${orderId}/context`, OrderContextResponse),
  });
}
