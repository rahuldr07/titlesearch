import { ReconciliationResponse } from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/**
 * THE BLIND-FIFTY DIVERGENCES FOR ONE ORDER.
 *
 * `GET /api/reconciliation/{order}` (endpoints.ts:338) is ORDER-SCOPED and the
 * handler filters on the id, so an unknown order gets an EMPTY list rather
 * than "someone else's divergences dressed up as this order's"
 * (handlers.ts:1276-1279). The path parameter is therefore load-bearing, not
 * decoration, and this is a descriptor FACTORY for the same reason
 * `queries.ts`'s `orderContext`/`orderFields` are: the order id is part of the
 * cache key or two orders share one cache.
 *
 * Same rule as `queries.ts` and `accountQueries.ts`: the DESCRIPTION of a read,
 * never the read. `presentational-fetches` keeps `@tanstack/react-query` out of
 * `shared/`; `app/useRead.ts` performs it.
 *
 * ══ THE ORDER IS NOT CHOSEN FROM A LIST, AND THERE IS NO LIST ══════════════
 *
 * `queries.ts` states it for the queue and it is the same rule here:
 * `endpoints.ts:69` — "there is no browse/pick endpoint" — and `INVARIANTS:22`
 * — the queue is a single server-chosen next order, "no list, no browsing, no
 * cherry-picking". Reconciliation is reached FROM an order, carrying its id.
 *
 * `DEMO_ORDER_ID` exists because the route `/reconciliation` currently has no
 * `:order` segment to read one from. It is a stand-in for the parameter, NOT a
 * default over a set — it names exactly one order, it cannot be pointed at a
 * second from the browser, and the screen says on its face that it is standing
 * in for a hand-over. The moment the route carries the id, this constant goes
 * and the factory below takes it unchanged.
 */

/** The one order the routeless screen can name. See the note above. */
export const DEMO_ORDER_ID = "ord_demo_1";

export function reconciliation(
  orderId: string,
): ReadDescriptor<ReconciliationResponse> {
  return {
    path: `/api/reconciliation/${orderId}`,
    key: ["reconciliation", orderId],
    schema: ReconciliationResponse,
  };
}
