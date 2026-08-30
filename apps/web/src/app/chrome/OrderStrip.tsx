import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { OrderContextResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";
import { cx } from "../../components/ui";
import { OrderStripStages } from "./OrderStripStages";
import { OrderCounts } from "./OrderCounts";
import { OrderStamp } from "./OrderStamp";
import { RouteButton } from "./RouteButton";

/**

 * THE ORDER BAR — white, hairline bottom, above `main` and inside the content column,

 * so it stays put while the screen scrolls under it (INVARIANT 62). Every value comes

 * from `GET /api/orders/{id}/context` (`intake.ts`), which exists…

 *

 * ⚠ RULED 2026-08-29 — `docs/frontend/design-2026-08/RULING-2026-08-29.md`:
 * the three refusals this header used to carry are superseded, because the
 * reference app DRAWS all three. The due chip prints the SERVED string whole
 * ("Due today · 5h 20m left" — no clock runs here); the place line arrives
 * finished on the context; and the Review (N) button prints the served
 * `outstanding` census figure and navigates to the workstation. The stage
 * tabs row below is the reference's, served per order (`stage_tabs`).
 */
const ORDER_PATH = /^\/orders\/([^/]+)/;

export function OrderStrip() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const orderId = ORDER_PATH.exec(pathname)?.[1] ?? null;

  const context = useQuery({
    queryKey: ["orders", orderId, "context"],
    queryFn: () => get(`/api/orders/${orderId}/context`, OrderContextResponse),
    enabled: orderId !== null,
  });

  // No order in the URL, no bar. The strip names the order it sits above; with
  // no order it would be a frame around nothing.
  if (orderId === null) return null;

  return (
    <header
      data-testid="order-strip"
      className="flex shrink-0 flex-col gap-5 border-b border-line-strong bg-surface-panel px-14 py-6"
    >
      {/* WRAPS: the ref, the place line, three server facts, four census
          figures, the due chip, the button and the stamp do not fit one 1360px
          line, and the alternatives are all the browser shortening the
          server's words. */}
      <div className="flex min-h-14 flex-wrap items-center gap-10">
        {context.data === undefined ? (
          /* INVARIANT 59 — a partial failure degrades this region only. The id
             from the URL is the one thing that is true without the server. */
          <span className="font-mono text-subject leading-flat text-ink-muted">
            {orderId}
          </span>
        ) : (
          <>
            {/* The reference's opening pair: the mono ref, then the finished
                place line ("1856 Defoor Ave NW, Atlanta · Fulton County, GA"). */}
            <span className="flex min-w-0 items-baseline gap-6">
              <span
                data-testid="order-ref"
                className="font-mono text-subject font-bold leading-flat text-ink-secondary"
              >
                {context.data.order_ref}
              </span>{" "}
              {context.data.place !== null && (
                <span className="truncate text-meta font-semibold leading-flat text-ink-primary">
                  {context.data.place}
                </span>
              )}
            </span>
            <Fact value={context.data.product} absent="No resolved product" pill />
            {/* Client name · page count, mono, the reference's own pairing. */}
            {context.data.client !== null && (
              <span className="font-mono text-meta leading-flat text-ink-muted">
                {context.data.client}
                {context.data.pages !== null && ` · ${context.data.pages} pp`}
              </span>
            )}
            <OrderCounts orderId={orderId} />
            <span className="ml-auto flex flex-wrap items-center gap-6">
              {/* The due chip — the SERVED label, whole. No countdown runs in
                  this browser; the string is the server's statement. */}
              {context.data.due !== null && (
                <span
                  data-testid="order-due"
                  className="rounded-pill bg-state-settled-surface px-5 py-2 font-mono text-meta font-semibold leading-flat text-state-settled"
                >
                  {context.data.due}
                </span>
              )}
              {/* Review (N) — N is the served census figure, never a tally. */}
              {context.data.outstanding !== null && context.data.outstanding > 0 && (
                <RouteButton
                  variant="primary"
                  size="sm"
                  to="/orders/$orderId/review"
                  params={{ orderId }}
                  data-testid="order-review-cta"
                >
                  Review ({context.data.outstanding})
                </RouteButton>
              )}
              <OrderStamp stamp={context.data.stamp} />
            </span>
          </>
        )}
      </div>
      {/* The reference's five stage tabs, off the same context read. */}
      {context.data !== undefined && (
        <OrderStripStages orderId={orderId} tabs={context.data.stage_tabs} />
      )}
    </header>
  );
}

/** A nullable server fact. Null is printed as the server's meaning, not "—". */
function Fact(props: {
  readonly value: string | null;
  readonly absent: string;
  readonly pill?: boolean;
}) {
  if (props.value === null) {
    return (
      <span className="text-meta leading-flat text-ink-faint">{props.absent}</span>
    );
  }
  return (
    <span
      className={cx(
        "text-meta leading-flat text-ink-secondary",
        props.pill === true &&
          "rounded-pill border border-line-strong bg-surface-sunken px-5 py-2 font-medium",
      )}
    >
      {props.value}
    </span>
  );
}
