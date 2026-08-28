import type { Order } from "@titlepipe/contract";
import { Card } from "../../components/ui";
import { OrderRef } from "../../entities/order/OrderRef";
import { SpotlightMeta } from "./SpotlightMeta";
import { RouteButton } from "../../app/chrome/RouteButton";

/**
 * THE SERVED ORDER, drawn in the prototype's spotlight card.
 *
 * `reference-app.html`, measured:
 *
 *     card    white, radius 14, border-left 4px #5B4B8A, 24px padding
 *     row 1   "Active Spotlight" pill · SLA chip · "Assigned: …"
 *     row 2   ref 28px w700 mono #454A55 · place 20px w600, SAME BASELINE
 *     row 3   product pill · Client: … · pages — 13px mono #6E7480
 *     actions "Audit History" 40px secondary · "Launch Workstation" primary
 *
 * Rows 1 and 3 were absent here before and row 2 was stacked rather than
 * baseline-aligned. What follows is which parts are drawn and which are
 * refused, so the omissions read as decisions rather than as unfinished work.
 *
 * ══ ROW 1: TWO OF ITS THREE ELEMENTS ARE REFUSED ═══════════════════════════
 *
 * - The **SLA chip** ("Due today · 5h 20m left") is a countdown, and a
 *   countdown is a timer. `INVARIANTS:84-85` — "no pace indicators, no
 *   throughput language, no timers, and no time ESTIMATES". It is also OWNER
 *   DECISION 2 and unresolved, so it is not drawn even provisionally.
 *   `CONFLICT-all-orders.md` §7 names it directly: "Do not add a `Due` column
 *   or an SLA chip anywhere, including the order bar."
 * - **"Assigned: D. Okafor"** has no field. `Order` (`entities.ts:32-63`) is
 *   the exhaustive shape and carries no assignee; `QueueBandOrder` omits one
 *   deliberately, so that a screen which drew the rows still could not offer a
 *   way to take one. Inventing the line would be the UI generating backend
 *   surface (hard rule 1).
 *
 * The "Active spotlight" pill IS drawn, in graphite rather than the prototype's
 * accent fill. Rule 1 spends the accent once per screen and this card already
 * carries it twice — the 4px left rail and the primary action — so a third
 * accent-filled element would make rule 1 an aspiration rather than a property
 * of the screen. `badge.tsx` records the same trade for its `accent` tone:
 * "once per screen, WITH the primary action rather than in addition to it."
 *
 * ══ ROW 3 IS ITS OWN COMPONENT ════════════════════════════════════════════
 *
 * `SpotlightMeta` — product, period and pages, each printing only if the order
 * carries it, and the reason the prototype's client name cannot be drawn.
 *
 * The place line beside the ref is the other loss. The prototype's reads "1856
 * Defoor Ave NW, Atlanta · Fulton County, GA"; `Order` has no street address —
 * `LifecycleOrder.addr` exists, but that is the census card's shape and not
 * this one — so the subject is the jurisdiction, which the order does carry.
 *
 * ══ THE TWO BUTTONS, AND WHY BOTH ARE REAL ═════════════════════════════════
 *
 * The prototype pairs "Audit History" with "Launch Workstation". Both map onto
 * routes that exist and draw different things, so both are built:
 *
 *   - Audit history → `/orders/{id}`, the order hub, which already draws the
 *     order's spine from `GET /api/orders/{id}/timeline` (`OrderHubScreen`). A
 *     separate modal over the same endpoint would be a second reader of one
 *     fact.
 *   - Open review → `/orders/{id}/review`, the workstation itself. The design's
 *     word is "Launch Workstation"; the CONTRACT'S word is REVIEW (`authz.ts:66`,
 *     `screen.review.enter`) and ANALYSIS-screens §3 says to rename where the
 *     two differ. The path is not cosmetic even where the title is.
 *
 * Both are LINKS, not buttons that navigate: middle-click, copy-link and the
 * back button all keep working, and INVARIANT 55's deep links stay first-class.
 */
export function SpotlightOrder(props: { readonly order: Order }) {
  const order = props.order;

  return (
    <Card className="border-l-4 border-l-action">
      <div className="flex flex-wrap items-center justify-between gap-12">
        <div className="flex min-w-0 flex-col gap-6">
          <span className="w-fit rounded-pill border border-line-strong bg-surface-sunken px-5 py-1 text-label font-semibold leading-flat text-ink-secondary">
            Active spotlight
          </span>

          <div className="flex flex-wrap items-baseline gap-7">
            <OrderRef orderRef={order.external_ref} emphasis="spotlight" />
            <span className="text-subject font-semibold leading-tight text-ink-primary">
              {order.jurisdiction}
            </span>
          </div>

          <SpotlightMeta order={order} />
        </div>

        <div className="flex shrink-0 items-center gap-6">
          {/*
           * `RouteButton`, not `LinkButton`: these are internal destinations
           * and `LinkButton` takes react-aria's `href`, a plain string that
           * nothing checks. `to`/`params` are checked against the route tree.
           */}
          <RouteButton
            variant="secondary"
            to="/orders/$orderId"
            params={{ orderId: order.id }}
            data-testid="spotlight-history"
          >
            Audit history
          </RouteButton>
          <RouteButton
            variant="primary"
            to="/orders/$orderId/review"
            params={{ orderId: order.id }}
            data-testid="spotlight-open"
          >
            Open review
          </RouteButton>
        </div>
      </div>
    </Card>
  );
}
