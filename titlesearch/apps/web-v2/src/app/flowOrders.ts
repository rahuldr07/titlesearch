import { orderFromPath } from "./orderFromPath";

/**
 * WHICH ORDER EACH FLOW SCREEN IS ABOUT — said once, in `app/`, out loud.
 *
 * RULE: the order a flow screen READS and the order the rail DRAWS are one
 * fact, and that fact is a pure function of the path. FAILURE PREVENTED: the
 * rail resolved the order from the URL (`orderFromPath`) while each screen held
 * a private constant of its own, so on `/completeness`, `/processing` and
 * `/questions` — none of which carry an order in the path — the rail was handed
 * `null` and drew six grey numbers: no checkmark, no badge, no progress, beside
 * a screen showing that very order's gate. Two resolvers, one of them blind.
 *
 * THE MAP LIVES ABOVE THE FEATURES, AND THE FEATURES READ IT. `app/` may know
 * about every screen; a feature may not know about another feature (§7). Owning
 * the map here is what lets `/completeness` and the rail agree without either
 * importing the other, and it turns three private literals — which could drift
 * apart with nothing failing — into one table with a test over it.
 *
 * THE THREE SCREENS ARE ABOUT DIFFERENT ORDERS, DELIBERATELY. `/questions` is
 * where a sign-off is ANSWERED and the live order's is already signed, so Wave 2
 * pointed it at the order still at intake (`features/questions/queries.ts`).
 * The rail therefore shows the state of THE ORDER THIS SCREEN IS ABOUT, not one
 * continuous journey; forcing a single order to make the rail read smoothly
 * would leave the answering screen with nothing left to answer.
 *
 * CONTRACT GAP: none of these routes is order-scoped. The map stands in until
 * intake gets `/orders/:id/{questions,processing,completeness}`, at which point
 * every entry here is deleted and `orderFromPath` answers on its own.
 */
export const FLOW_ORDERS = {
  "/questions": "ord_demo_4",
  "/processing": "ord_demo_1",
  "/completeness": "ord_demo_1",
} as const;

/**
 * TWO FLOW ROUTES ARE DELIBERATELY ABSENT, and absent is the honest answer.
 *
 * `/ingest` is where an order is CREATED — before the press there is no order
 * to name, and naming one would put another order's progress beside an empty
 * form. `/delivered` picks its own record from `GET /api/deliveries` by
 * `delivered_at` (`features/delivered/deliveredRecord.ts`); a constant here
 * would be a second answer to a question that already has one, free to disagree
 * with the receipt on screen.
 */
const BY_ROUTE: ReadonlyMap<string, string> = new Map(Object.entries(FLOW_ORDERS));

/** The order a flow route is about, or `null` for any other path. */
export function flowOrderFor(pathname: string): string | null {
  return BY_ROUTE.get(pathname) ?? null;
}

/**
 * The order the screen at `pathname` is about: the URL's where the route
 * carries one, else the flow route's.
 *
 * THE URL WINS, AND NOTHING REMEMBERS. There is no "current order" anywhere in
 * this app — two tabs on two orders is a normal way to work, and a remembered
 * id makes the second tab lie about the first. Both readers of this fact
 * (`AppChrome`'s rail, `OrderStrip`'s reference) call it rather than each
 * composing the same two lookups, because composing it twice is the shape of
 * the defect this file exists to close.
 */
export function screenOrderFor(pathname: string): string | null {
  return orderFromPath(pathname) ?? flowOrderFor(pathname);
}
