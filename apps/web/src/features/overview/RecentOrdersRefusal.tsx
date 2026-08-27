import { Link } from "@tanstack/react-router";
import { Card, CardBody, CardHeader } from "../../components/ui";

/**
 * WHERE THE DESIGN'S RECENT-ORDERS TABLE WOULD HAVE BEEN.
 *
 * Design §Screens 2, verbatim: "Recent orders table (last 10) linking to All
 * Orders." Both halves are refused, and this pane says so rather than leaving a
 * hole — a blank region reads as a screen that failed to load, and AGENTS.md
 * forbids emitting values that cannot be cited, which a plausible ten-row table
 * of order refs and addresses would be from top to bottom.
 *
 * ══ A "LAST 10" IS A BROWSE AFFORDANCE WITH A SMALLER NUMBER ON IT ═════════
 *
 * There is no order-list endpoint. `endpoints.ts:69` states it in words —
 * "GET /api/queue/next — server-ordered; there is no browse/pick endpoint" —
 * and `INVARIANTS:82-83` forbids one existing. Ten is not a special case of
 * that rule; it is the rule with a `LIMIT` clause.
 *
 * The table it links to is the same conflict from the other end: the design's
 * screen 3 at `/queue`, escalated under `INVARIANTS:26-27` and unresolved.
 *
 * ══ WHY THE LINK GOES TO THE QUEUE ═════════════════════════════════════════
 *
 * Because the queue is how a reader actually reaches an order, and a pane that
 * refuses something should point at the thing that works. It is not a
 * substitute for the table and does not pretend to be one.
 */
export function RecentOrdersRefusal() {
  return (
    <Card padding="none">
      <CardHeader>Recent orders</CardHeader>
      <CardBody className="flex flex-col gap-5 py-10">
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
      </CardBody>
    </Card>
  );
}
