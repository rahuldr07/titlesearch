import type { OrdersPageResponse } from "@titlepipe/contract";

/**
 * The window sentence, written once because it prints twice — beside the
 * filter tabs and in the pager's footer. `total` is the server's, printed
 * as it came; the window's end is how many rows the server actually sent,
 * not `page * page_size`, so a short last page says so.
 */
export function windowLabel(data: OrdersPageResponse): string {
  if (data.total === 0) return "0 orders";
  const first = (data.page - 1) * data.page_size + 1;
  return `Showing ${first}–${first + data.orders.length - 1} of ${data.total}`;
}
