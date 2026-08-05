import type { Role } from "@titlepipe/contract";
import { canOpen } from "./doors";

/**
 * THE FLOW IS SIX POSITIONS, ALWAYS, AND THE NUMBERING NEVER SHIFTS.
 *
 * RULE: the pipeline's shape is structural — a fixed sequence, drawn whether or
 * not an order is in view; only `done` and `badge` are order data. FAILURE
 * PREVENTED: `AppChrome` used to push Review onto the list only when the URL
 * carried an order, so off an order screen Delivered numbered 5 against the
 * export's 6 (`flowDef`, TitlePipe.dc.html:2919-2926) — while `LifecycleRail`'s
 * own comment claimed `n` was "drawn even with no active order". A position is
 * therefore read from the INDEX IN THIS LIST, never from the index of a
 * filtered copy of it.
 *
 * ONE DEFINITION. `AppChrome` and `doors.ts` each carried their own list and
 * disagreed about the labels; the paths, the labels and the order are written
 * once, here.
 */
export interface FlowStep {
  /** Stable identity, and the resolved route for every step but Review. */
  readonly path: string;
  readonly label: string;
  /** Review's screen is order-scoped, so its route is not a constant. */
  readonly orderScoped: boolean;
}

export const FLOW: readonly FlowStep[] = [
  { path: "/ingest", label: "Upload", orderScoped: false },
  { path: "/questions", label: "Questions", orderScoped: false },
  { path: "/processing", label: "Processing", orderScoped: false },
  { path: "/completeness", label: "Completeness", orderScoped: false },
  // The unfilled ROUTE PATTERN, not a URL: it is this step's stable identity
  // (and testid suffix) while no order is in view, and it cannot be mistaken
  // for somewhere a click could go.
  { path: "/orders/:orderId/review", label: "Review", orderScoped: true },
  { path: "/delivered", label: "Delivered", orderScoped: false },
];

/** A step and the position it draws — the index it held BEFORE any filter. */
export interface FlowPosition {
  readonly step: FlowStep;
  readonly n: number;
}

/**
 * The stages this role may enter, each carrying its structural position.
 *
 * EVERY STAGE GOES THROUGH `canOpen`, REVIEW INCLUDED. `AppChrome` filtered
 * with `to.startsWith("/orders/") || held.has(to)`, and the first clause
 * short-circuits the second: the Review row drew for EVERY role, including one
 * the authz table refuses. There is no second gate and no order-shaped
 * exception — the rail's affordances and the server's refusals read the one
 * table (`doors.ts`), which is the only reason they cannot drift apart.
 *
 * THE NUMBER IS TAKEN BEFORE THE FILTER, so a stage a role cannot enter never
 * renumbers the ones after it: a reviewer holds no `/ingest` and still reads
 * Delivered as six.
 */
export function flowFor(role: Role): FlowPosition[] {
  return FLOW.map((step, i) => ({ step, n: i + 1 })).filter(({ step }) => canOpen(role, step.path));
}

/**
 * The route a step opens, or `null` when it names a position with no
 * destination yet — Review before an order is in view. Returning null rather
 * than a plausible URL is the point: the row still draws, and still counts, but
 * it does not offer a journey the app cannot make.
 */
export function flowRoute(step: FlowStep, orderId: string | null): string | null {
  if (!step.orderScoped) return step.path;
  return orderId === null ? null : `/orders/${orderId}/review`;
}

/**
 * The group header over the rail.
 *
 * RULE: the header must not name an order there is none of. The export always
 * says "This order" because it carries one global demo order; this app resolves
 * order identity per path (`app/flowOrders.ts`), and printing THIS ORDER over
 * six stages beside a strip that declines to name one is the screen
 * contradicting itself. The stages are still drawn — the flow is structural —
 * so where there is no order the header names the flow instead. Where there IS
 * one, `OrderStrip` resolves it the same way and prints its reference, so the
 * two halves of the chrome are never talking about different orders.
 *
 * Literal capitals, in the string: a CSS `text-transform` does not change what
 * the text says, and the rail's other headers are spelled the same way.
 */
export function flowSectionLabel(orderId: string | null): string {
  return orderId === null ? "THE FLOW" : "THIS ORDER";
}
