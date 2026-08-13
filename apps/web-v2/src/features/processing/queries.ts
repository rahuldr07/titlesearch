import { queryOptions } from "@tanstack/react-query";
import { OrderPipelineResponse } from "@titlepipe/contract";
import { FLOW_ORDERS } from "../../entities/nav/flowOrders";
import { get } from "../../shared/api";

/**
 * CONTRACT GAP: the intake flow has no order-scoped route. `/processing` is
 * reached from the chrome menu with nothing in the URL, so the demo order
 * stands in until intake gets `/orders/:id/processing`. Adding that route is a
 * routing change and is deliberately not made here.
 *
 * RE-EXPORTED, NEVER RESTATED. `app/flowOrders.ts` owns which order each flow
 * route is about, because the left rail has to know it too and a feature may
 * not be imported by the chrome (§7). This was a private literal, and the rail
 * — resolving from the URL instead — drew this screen's order as no order at
 * all. A second copy of the id is a second answer waiting to disagree.
 */
export const PIPELINE_ORDER_ID = FLOW_ORDERS["/processing"];

/**
 * The run's stages, as the server has them.
 *
 * EVERY PHASE IS READ, NEVER INFERRED. The moment a screen concludes
 * "extraction must be done by now" from a stage list, it has become a second
 * copy of the pipeline's state machine — and `gate_halted` arrives as its own
 * field for exactly that reason: a halt is server state, not something to be
 * spotted in the rows.
 */
export function orderPipelineQuery(orderId: string) {
  return queryOptions({
    queryKey: ["orders", orderId, "pipeline"],
    queryFn: () => get(`/api/orders/${orderId}/pipeline`, OrderPipelineResponse),
  });
}
