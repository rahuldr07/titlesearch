import type { LifecycleStamp, OrderCensus } from "@titlepipe/contract";
import { ProgressMeter } from "../../components/ui";
import { RouteButton } from "../../app/chrome/RouteButton";

/**
 * The verdict band: kicker pill, 40px verdict, note, dot meter, primary action.
 *
 * `LifecycleStamp.label` is the server's already-chosen word — nothing here
 * reads it, and `tone` drives paint and nothing else (`intake.ts:290-294`).
 *
 * The meter draws the pair the design draws (README §Screens 4, "'N of M
 * decisions settled'"): `OrderCensus.settled`/`decisions` — server-counted,
 * never `fields - needs_review`, which is the arithmetic the shape exists to
 * remove. It is the KIT meter (`components/ui/progress-meter.tsx`), the same
 * one `DecisionDock` renders, so the hub and the workstation cannot draw the
 * same figure two ways — one dot PER decision, and past MAX_DOTS the graphic
 * is refused and the mono count stands alone (rule 11).
 */
export function VerdictCard(props: {
  readonly stamp: LifecycleStamp;
  /** The server's four figures. Absent = the server did not say (never zero). */
  readonly census: OrderCensus | undefined;
  readonly orderId: string;
}) {
  return (
    <section className="flex flex-wrap items-start justify-between gap-8 border-b border-line-subtle p-12">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <span
          data-testid="verdict-kicker"
          className={`w-fit rounded-pill border px-5 py-1 text-label font-bold leading-flat ${PILL[props.stamp.tone]}`}
        >
          Order life-cycle hub
        </span>

        {/* 40px — the sixth type size, and the one place the product spends it. */}
        <p
          data-testid="verdict"
          className={`text-verdict font-bold leading-tight tracking-tight ${INK[props.stamp.tone]}`}
        >
          {props.stamp.label}
        </p>

        <p className="max-w-310 text-body leading-body text-ink-secondary">
          The server chose that word. Nothing on this screen recomputes it, and no
          number below is added up here.
        </p>

        {/* `settled`/`decisions` are AWAITING RATIFICATION on `OrderCensus`
            (endpoints.ts, the ⚠ block) — optional, and absent is "the server
            did not say", printed as silence rather than filled in. */}
        {props.census?.settled === undefined ||
        props.census.decisions === undefined ? (
          <p data-testid="census-silent" className="text-meta leading-close text-ink-muted">
            The server sent no decision census for this order. That is not zero — it
            is the server not saying.
          </p>
        ) : (
          <ProgressMeter
            label="Decisions settled"
            settled={props.census.settled}
            total={props.census.decisions}
            caption={`${props.census.settled} of ${props.census.decisions} decisions settled`}
          />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-6">
        <RouteButton
          variant="secondary"
          size="lg"
          to="/orders/$orderId/release"
          params={{ orderId: props.orderId }}
          data-testid="hub-release"
        >
          Release compiler
        </RouteButton>
        <RouteButton
          variant="primary"
          size="lg"
          to="/orders/$orderId/review"
          params={{ orderId: props.orderId }}
          data-testid="hub-cta"
        >
          Open review →
        </RouteButton>
      </div>
    </section>
  );
}

const INK = {
  neutral: "text-ink-primary",
  action: "text-action",
  settled: "text-state-settled",
  attend: "text-state-attend",
  halt: "text-state-halt",
} as const;

const PILL = {
  neutral: "border-line-strong bg-surface-sunken text-ink-secondary",
  action: "border-action-border-strong bg-action-surface text-ink-secondary",
  settled: "border-state-settled-border bg-state-settled-surface text-state-settled",
  attend: "border-state-attend-border bg-state-attend-surface text-state-attend",
  halt: "border-state-halt-border bg-state-halt-surface text-state-halt",
} as const;
