/**
 * The order-scoped search string — exactly two keys. `field` lands a deep
 * link on the exact field in context; `page` opens the workstation at a
 * page. Selection held in component state is selection nobody can link to,
 * reload into, or send to a colleague. Deliberately absent: filter, sort,
 * page size, query — a URL is not a loophole in a browse rule the API
 * already enforces. `page` is validated rather than trusted: a value that is
 * not a positive integer is dropped, leaving the key absent, which is a
 * state the screen already handles — unlike a poisoned one.
 */
export interface OrderSearch {
  field?: string;
  page?: number;
}

export function orderSearch(search: Record<string, unknown>): OrderSearch {
  const parsed: OrderSearch = {};
  if (typeof search["field"] === "string") parsed.field = search["field"];
  const page = Number(search["page"]);
  if (Number.isInteger(page) && page > 0) parsed.page = page;
  return parsed;
}
