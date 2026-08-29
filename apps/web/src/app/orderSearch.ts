/**
 * THE ORDER-SCOPED SEARCH STRING, AND IT HAS EXACTLY TWO KEYS.
 *
 * `validateSearch` is what makes selection a TYPED part of the route rather
 * than a query string somebody remembers to read: navigating with a misspelled
 * key does not compile.
 *
 * WHAT IS HERE:
 *   - `field` — INVARIANT 55, deep links land on the exact field in context.
 *   - `page` — the extraction matrix (design §Screens 6) opens the workstation
 *     AT a page. Selection held in component state is selection nobody can
 *     link to, reload into, or send to a colleague.
 *
 * WHAT IS DELIBERATELY ABSENT: no filter, no sort, no page SIZE, no query.
 * Those are the browse affordance arriving through the search string after
 * having been refused at the endpoint (endpoints.ts:69, INVARIANTS:82-83), and
 * a URL is not a loophole in a rule the API already enforces.
 *
 * `page` is VALIDATED rather than trusted. `Number("banana")` is `NaN` and
 * `Number("")` is `0`; either one reaching a component as a page number is a
 * matrix cell nobody can find and an off-by-one nobody can explain. A value
 * that is not a positive integer is dropped, which leaves the key absent —
 * and absent is a state the screen already handles, unlike a poisoned one.
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
