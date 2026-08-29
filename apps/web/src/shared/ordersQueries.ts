import { OrdersPageResponse, type OrderFilter } from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

export interface OrdersBrowse {
  readonly query: string;
  readonly filter: OrderFilter;
  /** 1-based, as the server counts. */
  readonly page: number;
}

/**
 * `GET /api/orders`. Kept out of `queries.ts`, whose header records that this
 * endpoint did not exist; all three inputs are part of the cache key, because a
 * different page of a different filter is a different answer.
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
