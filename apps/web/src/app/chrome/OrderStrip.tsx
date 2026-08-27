import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { OrderContextResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";
import { cx } from "../../components/ui/cx";

/**
 * THE ORDER BAR — white, hairline bottom, above `main` and inside the content
 * column, so it stays put while the screen scrolls under it (INVARIANT 62).
 *
 * Every value comes from `GET /api/orders/{id}/context`
 * (`intake.ts:301`), which exists precisely because an order-scoped screen has
 * the URL id and nothing else. Nothing on this bar is computed here.
 *
 * ══ WHAT THE DESIGN ASKED FOR THAT THE CONTRACT REFUSES ════════════════════
 *
 * Design README §App shell: the bar "shows ref (mono, 18px), address, product
 * pill, SLA CHIP, primary action button, and 5 STAGE TABS."
 *
 *   - THE SLA CHIP IS DELETED. `INVARIANTS:84-85`: "No pace indicators, no
 *     throughput language, no timers, and no time ESTIMATES — an estimate is a
 *     pace indicator." There is no SLA field anywhere in the contract to bind
 *     one to, which is the same refusal expressed as an absence.
 *   - THE 5 STAGE TABS ARE NOT BUILT. ANALYSIS-screens §3: the design collapses
 *     three different state machines (`FieldState` 6 members, `PipelineStage`/
 *     `StagePhase` 4, `StageKind` 4) into one 1-5 rail. Drawing them would mean
 *     the browser deciding which machine each tab belongs to. The server's own
 *     `LifecycleStamp` (intake.ts:296) is drawn instead — one word it already
 *     chose, plus the `tone` that is its only machine-readable axis.
 *   - ADDRESS IS ABSENT from `OrderContextResponse`. `period_label` is what the
 *     endpoint carries and it is a RENDERED LABEL, never a machine-readable
 *     span (entities.ts:53-56). The bar prints it and does not pretend it is an
 *     address.
 *   - 18px IS NOT A TYPE SIZE (rule 2: 11/13/16/20/28/40). The ref renders at
 *     `--text-subject` (20px), mono per rule 3. Flagged, not invented.
 *   - THE PRIMARY ACTION is not drawn here. Rule 1 spends the accent ONCE per
 *     screen, and the screen below owns its own decision; a permanent accent
 *     button in the chrome would spend it before every screen begins.
 *
 * `product` and `pages` are NULLABLE and null is a STATEMENT, not a dash:
 * entities.ts:50-53 — null means no resolved product, and a count asserts
 * somebody looked. The bar says so in words.
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
      className="flex h-26 shrink-0 items-center gap-10 border-b border-line-strong bg-surface-panel px-12"
    >
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
            className="font-mono text-subject font-semibold leading-flat text-ink-primary"
          >
            {context.data.order_ref}
          </span>
          <Fact
            value={context.data.product}
            absent="No resolved product"
            pill
          />
          <Fact value={context.data.period_label} absent="No period on record" />
          <Fact
            value={
              context.data.pages === null ? null : `${context.data.pages} pages`
            }
            absent="Page count unread"
          />
          <Stamp stamp={context.data.stamp} />
        </>
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

/**
 * `tone` drives the paint and NOTHING ELSE (intake.ts:290-294). `label` is a
 * free string on purpose — an enum here would be an invitation to `switch` on
 * a lifecycle word, which is the client state machine moved one line down.
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
