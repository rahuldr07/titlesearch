import type { LifecycleStamp, OrderCensus } from "@titlepipe/contract";
import { Card } from "../../components/ui";
import { ProgressMeter } from "../../entities/order/ProgressMeter";
import { RouteButton } from "../../app/chrome/RouteButton";

/**
 * THE VERDICT CARD — design §Screens 4: "kicker pill, verdict 40px, note,
 * 18-dot progress meter + 'N of M decisions settled' (mono), primary CTA."
 *
 * ══ THE VERDICT IS THE SERVER'S WORD, NOT A COMPOSED ONE ═══════════════════
 *
 * `LifecycleStamp` (`intake.ts:296`) carries `label` and `tone`, and the
 * contract is explicit about why: the 2026-07-28 export computed that word from
 * a FIVE-BRANCH `if/else` in the browser over `allSignoff` / `compOpen` /
 * `allAnswered` / the current screen, "a client-side lifecycle state machine
 * and hard rule 3 forbids it, so the word arrives already chosen."
 *
 * `label` is a free string ON PURPOSE — "an enum is an invitation to `switch`
 * on it, and a `switch` on a lifecycle word is the same state machine moved one
 * line down." So nothing here reads the label; `tone` drives the paint and
 * nothing else, which is the only machine-readable axis the shape has.
 *
 * ══ THE METER, AND THE NUMBER THE CONTRACT DOES NOT SERVE ══════════════════
 *
 * The design's meter reads "N of M DECISIONS SETTLED", and in the prototype
 * that N is `answeredTotal = D.base + a` — browser arithmetic printed as a
 * headline census. `OrderCensus` (`endpoints.ts:139-160`) exists precisely
 * because that was already happening, and says so: "a count whose definition
 * lives in a component is a count nobody can audit against the pipeline."
 *
 * `OrderCensus` carries four figures — `fields`, `auto_confirmed`,
 * `needs_review`, `no_source` — AND NOT A SETTLED COUNT. Deriving one would be
 * `fields - needs_review`, which is exactly the arithmetic the shape was
 * written to take away, so it is not derived. The meter is drawn over the pair
 * the server DOES state (`auto_confirmed` of `fields`) and LABELLED AS THAT,
 * and the card says in words that "decisions settled" is not a figure the
 * contract serves. A meter measuring one thing under a caption naming another
 * is the defect; a meter measuring what it says is not.
 *
 * That gap is a backend request, recorded in `CONFLICT-all-orders.md` §4
 * alongside the other one this screen ran into. It is not closed here.
 */
export function VerdictCard(props: {
  readonly stamp: LifecycleStamp;
  /** The server's four figures. Absent = the server did not say (never zero). */
  readonly census: OrderCensus | undefined;
  readonly orderId: string;
}) {
  return (
    <Card className={`border-l-4 ${RAIL[props.stamp.tone]}`}>
      <div className="flex items-start justify-between gap-14">
        <div className="flex flex-col gap-6">
          <span
            data-testid="verdict-kicker"
            className={`w-fit rounded-pill border px-6 py-2 text-label font-semibold leading-flat ${PILL[props.stamp.tone]}`}
          >
            Order life-cycle hub
          </span>
          {/* 40px — `--text-verdict`, the sixth size, and the one place in the
              product it is spent. */}
          <p
            data-testid="verdict"
            className="text-verdict font-bold leading-tight text-ink-primary"
          >
            {props.stamp.label}
          </p>
          <p className="max-w-240 text-meta leading-body text-ink-secondary">
            The server chose that word. Nothing on this screen recomputes it,
            and no number below is added up here.
          </p>

          {props.census === undefined ? (
            <p
              data-testid="census-silent"
              className="text-meta leading-close text-ink-faint"
            >
              The server sent no census with this order's fields. That is not
              zero — it is the server not saying.
            </p>
          ) : (
            <ProgressMeter
              settled={props.census.auto_confirmed}
              total={props.census.fields}
              noun="fields auto-confirmed by the pipeline"
            />
          )}
        </div>

        {/*
         * Rule 1: the single accent spend on this screen. `…/review` is the
         * order-scoped review screen, beneath the SAME `/orders` door
         * (`authz.ts:50` — a screen permission guards the route PREFIX), so
         * this invents no path. The hub is where you land; review is where you
         * work.
         */}
        <RouteButton
          variant="primary"
          to="/orders/$orderId/review"
          params={{ orderId: props.orderId }}
          data-testid="hub-cta"
        >
          Open review
        </RouteButton>
      </div>
    </Card>
  );
}

/** `tone` drives paint and nothing else (`intake.ts:290-294`). */
const RAIL = {
  neutral: "border-l-line-strong",
  action: "border-l-action",
  settled: "border-l-state-settled",
  attend: "border-l-state-attend",
  halt: "border-l-state-halt",
} as const;

const PILL = {
  neutral: "border-line-strong bg-surface-sunken text-ink-secondary",
  action: "border-action-border bg-action-surface text-action",
  settled: "border-state-settled-border bg-state-settled-surface text-state-settled",
  attend: "border-state-attend-border bg-state-attend-surface text-state-attend",
  halt: "border-state-halt-border bg-state-halt-surface text-state-halt",
} as const;
