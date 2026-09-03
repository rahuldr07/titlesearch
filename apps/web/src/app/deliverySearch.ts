/**
 * The delivered screen's search string — one key. `?order=` names which
 * delivered order the grid is scoped to.
 *
 * It exists because the stage strip's last step is the only one that is not
 * order-scoped: every other step routes to `/orders/{id}/…` while "Delivery
 * & Gateway Seal" routed to a bare `/delivery`, which defaults to the first
 * record in the list. Opening stage 5 on one order therefore showed another
 * order's certified PDF and seal — a different lender's document under this
 * order's heading.
 *
 * An unrecognised value is dropped, leaving the key absent, which the screen
 * handles as "show the first delivered order".
 */
export interface DeliverySearch {
  order?: string;
}

export function deliverySearch(search: Record<string, unknown>): DeliverySearch {
  const order = search["order"];
  return typeof order === "string" && order.length > 0 ? { order } : {};
}
