import { queryOptions } from "@tanstack/react-query";
import { OrderSignoffResponse } from "@titlepipe/contract";
import { FLOW_ORDERS } from "../../app/flowOrders";
import { get } from "../../shared/api";

/**
 * CONTRACT GAP: the intake flow has no order-scoped route. `/questions` is
 * reached from the chrome menu with nothing in the URL, so there is no id to
 * read — the demo order stands in until intake gets `/orders/:id/questions`.
 * Adding that route is a routing change and is deliberately not made here.
 *
 * THE INTAKE-STAGE ORDER, NOT THE LIVE ONE. `/questions` is where a sign-off is
 * ANSWERED, and the live order's has been signed. Pointing both screens at one
 * order forced the fixture to be signed and unsigned at once — and a signed
 * sign-off carries no policy suggestion, so the one screen whose job is
 * answering had nothing left to answer.
 *
 * RE-EXPORTED, NEVER RESTATED. `app/flowOrders.ts` owns which order each flow
 * route is about, because the left rail has to know it too and a feature may
 * not be imported by the chrome (§7). It is also the only place the divergence
 * above is visible at a glance: two flow screens read `ord_demo_1` and this one
 * does not, and a rail that showed one continuous journey across the three
 * would be claiming a progression none of them share.
 */
export const SIGNOFF_ORDER_ID = FLOW_ORDERS["/questions"];

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
