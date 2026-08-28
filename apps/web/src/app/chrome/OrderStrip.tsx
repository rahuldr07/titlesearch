import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { OrderContextResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";
import { cx } from "../../components/ui";
import { OrderStripStages } from "./OrderStripStages";
import { OrderCounts } from "./OrderCounts";
import { OrderStamp } from "./OrderStamp";

/**

 * THE ORDER BAR — white, hairline bottom, above `main` and inside the content column,

 * so it stays put while the screen scrolls under it (INVARIANT 62). Every value comes

 * from `GET /api/orders/{id}/context` (`intake.ts:301`), which exists…

 *
 * THREE THINGS THE DESIGN DRAWS HERE ARE REFUSED. The SLA chip
 * ("Due today · 5h 20m left") is INVARIANT 23 — no countdown, no elapsed. The
 * property address has no order-scoped read: `addr`/`place` live on `OrderRow`
 * (design.ts:31), the permission-scoped browse row, and fetching a paginated
 * list to find one order's address is not a source. CONTRACT GAP: an address on
 * `OrderContextResponse`. The primary-action button is the design computing
 * which action comes next from client state — hard rule 3 — and each screen
 * already carries its own.
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
      {/* WRAPS, for the reason the stage row below wraps: the ref, three server
          facts, four census figures and a stamp do not fit one 1360px line, and
          the alternatives are all the browser shortening the server's words. */}
      <div className="flex min-h-14 flex-wrap items-center gap-10">
        {context.data === undefined ? (
          /* INVARIANT 59 — a partial failure degrades this region only. The id
             from the URL is the one thing that is true without the server. */
          <span className="font-mono text-subject leading-flat text-ink-muted">
            {orderId}
          </span>
        ) : (
          <>
            {/* "ORDER 4176034-1" — the design's own spelling (intake.ts:289).
                The rubric is a sibling so `order-ref` still carries the ref and
                nothing else; the space between them is a real text node. */}
            <span className="flex items-baseline gap-4">
              <span className="text-label font-semibold leading-flat tracking-caps text-ink-muted">
                ORDER
              </span>{" "}
              <span
                data-testid="order-ref"
                className="font-mono text-subject font-bold leading-flat text-ink-secondary"
              >
                {context.data.order_ref}
              </span>
            </span>
            <Fact value={context.data.product} absent="No resolved product" pill />
            <Fact value={context.data.period_label} absent="No period on record" />
            <Fact
              value={context.data.pages === null ? null : `${context.data.pages} pages`}
              absent="Page count unread"
            />
            <OrderCounts orderId={orderId} />
            <OrderStamp stamp={context.data.stamp} />
          </>
        )}
      </div>
      {/* Its own query, so a failed context still leaves the stages standing. */}
      <OrderStripStages orderId={orderId} />
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
