import { Link } from "@tanstack/react-router";
import { Card } from "../../components/ui";

/**
 * WHERE THE PROTOTYPE'S RECENT-ORDERS TABLE WOULD HAVE BEEN.
 *
 * The heading treatment is the prototype's and was wrong here before: it drew
 * "Recent orders" inside a card cap, where `reference-app.html` sets it OUTSIDE
 * the surface as a section heading — 16px w700 ink, a mono count beside it, and
 * a "View all orders →" button pushed to the right edge — with the table's card
 * below. The heading is now in that position, at that size.
 *
 * Two of its three parts are refused, and the pane says so rather than leaving a
 * hole: a blank region reads as a screen that failed to load, and AGENTS.md
 * forbids emitting values that cannot be cited, which a plausible ten-row table
 * of order refs, addresses, assignees and due times would be from top to bottom.
 *
 * ══ THE MONO COUNT ("Latest 10 of 35") ═════════════════════════════════════
 *
 * Both halves of it are unavailable, for different reasons. "10" counts rows in
 * a list that is not fetched. "35" is a total over all orders, which no
 * endpoint serves — `LifecycleResponse.total` is a census of the shop's book
 * and is not the same number, and printing it here under a caption about
 * "recent orders" would be the caption defect `CONFLICT-all-orders.md` §4
 * names.
 *
 * ══ A "LAST 10" IS A BROWSE AFFORDANCE WITH A SMALLER NUMBER ON IT ═════════
 *
 * There is no order-list endpoint. `endpoints.ts:69` states it in words —
 * "GET /api/queue/next — server-ordered; there is no browse/pick endpoint" —
 * and `INVARIANTS:82-83` forbids one existing. Ten is not a special case of
 * that rule; it is the rule with a `LIMIT` clause. The `Due` column and the
 * per-row `Open →` are separately refused by `INVARIANTS:84-85` (an estimate is
 * a pace indicator) and `INVARIANTS:82` (cherry-picking) respectively, and
 * `Assigned` has no field on any shape in the contract.
 *
 * ══ WHY THERE IS NO "VIEW ALL ORDERS →" BUTTON ═════════════════════════════
 *
 * It is the same conflict from the other end: the prototype's screen 3, which
 * is OWNER DECISION 1 and unresolved. A button to a screen that four rules
 * forbid building is not a link, it is a promise. The link below goes to the
 * queue instead — because the queue is how a reader actually reaches an order,
 * and a pane that refuses something should point at the thing that works. It is
 * not a substitute for the table and does not pretend to be one.
 */
export function RecentOrdersRefusal() {
  return (
    <section className="flex flex-col gap-8">
      <h2 className="text-body font-bold leading-tight text-ink-primary">
        Recent orders
      </h2>
      <Card>
        <div className="flex flex-col gap-5">
          <p className="max-w-260 text-meta leading-body text-ink-secondary">
            Not built, and not pending. The design draws the last ten orders here
            linking to a browsable table; no endpoint lists orders and the
            contract removed one by construction, so there is nothing to list and
            nowhere to link. The way to an order is the queue serving you one, or
            a deep link somebody sent you.
          </p>
          <p className="text-meta leading-body text-ink-secondary">
            The collision and the options for resolving it are written up in{" "}
            {/* Rule 3: a path is an identifier, which is data. */}
            <span className="font-mono text-label text-ink-muted">
              docs/frontend/design-2026-08/CONFLICT-all-orders.md
            </span>
            .
          </p>
          <Link
            to="/queue"
            className="tp-state w-fit text-meta font-semibold leading-close text-action underline-offset-4 hover:underline"
          >
            Go to the queue
          </Link>
        </div>
      </Card>
    </section>
  );
}
