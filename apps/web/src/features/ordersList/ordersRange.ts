import type { OrdersPageResponse } from "@titlepipe/contract";

/**
 * The window sentence, written once because the design prints it twice — above
 * the table beside the filter tabs, and again in the pager's footer. Rule 11:
 * one variable, never two literals.
 *
 * `total` is the server's and is printed as it came. The window's end is how
 * many rows the server actually sent, not `page * page_size`, so a short last
 * page says so instead of claiming ten.
 */
export function windowLabel(data: OrdersPageResponse): string {
  if (data.total === 0) return "0 orders";
  const first = (data.page - 1) * data.page_size + 1;
  return `Showing ${first}–${first + data.orders.length - 1} of ${data.total}`;
}
