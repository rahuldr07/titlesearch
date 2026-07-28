import { queryOptions } from "@tanstack/react-query";
import { OrderCompletenessResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";

/**
 * CONTRACT GAP: the intake flow has no order-scoped route. `/completeness` is
 * reached from the chrome menu with nothing in the URL, so the demo order
 * stands in until intake gets `/orders/:id/completeness`. Adding that route is
 * a routing change and is deliberately not made here.
 */
export const COMPLETENESS_ORDER_ID = "ord_demo_1";

/**
 * The gate, and the gaps it raised.
 *
 * `gate_open` IS THE SERVER'S VERDICT and arrives beside the gaps rather than
 * being counted out of them. A screen that decided the package was complete
 * because its own list looked empty would be a second gate — and this one holds
 * a run back from the most expensive step in the product.
 *
 * `close_options` likewise: the ways out of a gap are the server's to offer.
 * The screen renders them and never invents one.
 */
export function orderCompletenessQuery(orderId: string) {
  return queryOptions({
    queryKey: ["orders", orderId, "completeness"],
    queryFn: () => get(`/api/orders/${orderId}/completeness`, OrderCompletenessResponse),
  });
}
