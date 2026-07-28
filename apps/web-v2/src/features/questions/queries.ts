import { queryOptions } from "@tanstack/react-query";
import { OrderSignoffResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";

/**
 * CONTRACT GAP: the intake flow has no order-scoped route. `/questions` is
 * reached from the chrome menu with nothing in the URL, so there is no id to
 * read — the demo order stands in until intake gets `/orders/:id/questions`.
 * Adding that route is a routing change and is deliberately not made here.
 */
export const SIGNOFF_ORDER_ID = "ord_demo_1";

/**
 * The effective sign-off list for one order.
 *
 * THE SERVER RESOLVES IT, the screen does not assemble it. The list is a
 * product baseline with the client's waive / add / narrow / replace overrides
 * applied and the result versioned; a client that rebuilt it from a product
 * code and an override table would be a second resolver, free to disagree with
 * the one that decides what was actually ordered.
 *
 * `prefilled_from_policy` arrives as its own flag rather than as a filled-in
 * `answer` for the same reason — a suggestion and a signature must stay
 * distinguishable on the wire, or the screen cannot tell a claim from a default
 * (open ruling Q13).
 */
export function orderSignoffQuery(orderId: string) {
  return queryOptions({
    queryKey: ["orders", orderId, "signoff"],
    queryFn: () => get(`/api/orders/${orderId}/signoff`, OrderSignoffResponse),
  });
}
