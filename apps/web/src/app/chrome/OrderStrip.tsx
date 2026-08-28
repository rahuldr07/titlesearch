import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { OrderContextResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";
import { cx } from "../../components/ui";
import { OrderStripStages } from "./OrderStripStages";

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
      <div className="flex min-h-14 items-center gap-10">
        {context.data === undefined ? (
          /* INVARIANT 59 — a partial failure degrades this region only. The id
             from the URL is the one thing that is true without the server. */
          <span className="font-mono text-subject leading-flat text-ink-muted">
            {orderId}
          </span>
        ) : (
          <>
            <span
              data-testid="order-ref"
              className="font-mono text-subject font-bold leading-flat text-ink-secondary"
            >
              {context.data.order_ref}
            </span>
            <Fact value={context.data.product} absent="No resolved product" pill />
            <Fact value={context.data.period_label} absent="No period on record" />
            <Fact
              value={context.data.pages === null ? null : `${context.data.pages} pages`}
              absent="Page count unread"
            />
            <Stamp stamp={context.data.stamp} />
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

/**

 * `tone` drives the paint and NOTHING ELSE (intake.ts:290-294). `label` is a free

 * string on purpose — an enum here would be an invitation to `switch` on a lifecycle

 * word, which is the client state machine moved one line down.

 */
const TONE = {
  neutral: "border-line-strong bg-surface-sunken text-ink-secondary",
  action: "border-action-border bg-action-surface text-action",
  settled: "border-state-settled-border bg-state-settled-surface text-state-settled",
  attend: "border-state-attend-border bg-state-attend-surface text-state-attend",
  halt: "border-state-halt-border bg-state-halt-surface text-state-halt",
} as const;

function Stamp(props: {
  readonly stamp: { readonly label: string; readonly tone: keyof typeof TONE };
}) {
  return (
    <span
      data-testid="order-stamp"
      className={cx(
        "ml-auto rounded-pill border px-6 py-2 text-label font-semibold leading-flat",
        TONE[props.stamp.tone],
      )}
    >
      {props.stamp.label}
    </span>
  );
}
