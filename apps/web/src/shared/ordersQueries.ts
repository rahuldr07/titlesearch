import { OrdersPageResponse, type OrderFilter } from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/**
 * THE BROWSE READ. `queries.ts` records that there was no order-list endpoint;
 * `GET /api/orders` landed under the 2026-08-28 ruling and this is its one
 * spelling. It stays out of `queries.ts` so that file's account of the absence
 * reads as history rather than as a contradiction.
 */
export interface OrdersBrowse {
  readonly query: string;
  readonly filter: OrderFilter;
  /** 1-based, as the server counts. */
  readonly page: number;
}

/**
 * The three browse inputs are part of the CACHE KEY, not just the URL: a
 * different page of a different filter is a different answer, and sharing one
 * key across them is the silent-stale defect `queries.ts` names.
 */
export function ordersPage(browse: OrdersBrowse): ReadDescriptor<OrdersPageResponse> {
  const search = new URLSearchParams({
    q: browse.query,
    filter: browse.filter,
    page: String(browse.page),
  });
  return {
    path: `/api/orders?${search.toString()}`,
    key: ["orders", "browse", browse.query, browse.filter, browse.page],
    schema: OrdersPageResponse,
  };
}
