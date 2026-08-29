import type { LifecycleFigure } from "@titlepipe/contract";
import { Card, cx } from "../../components/ui";
import type { CensusNoteTone, CensusTone } from "../../entities/lifecycle/census";

/**
 * One census card — label 11px, value 28px, note 13px, the prototype's own
 * geometry. The note line USED to be refused here, citing
 * CONFLICT-overview-stats §5; RULING-2026-08-28 resolved that conflict by
 * Option A, so `LifecycleFigure` now carries label, value AND note off the
 * wire, and all three are printed verbatim. Nothing on this card is authored
 * or computed in the browser.
 */
const FIGURE_TONE = {
  primary: "text-ink-primary",
  secondary: "text-ink-secondary",
  attend: "text-state-attend",
  settled: "text-state-settled",
} as const satisfies Record<CensusTone, string>;

/* The reference draws the settled note at weight 600; the attend note plain. */
const NOTE_TONE = {
  muted: "text-ink-muted",
  attend: "text-state-attend",
  settled: "font-semibold text-state-settled",
} as const satisfies Record<CensusNoteTone, string>;

export function StatCard(props: {
  /** SERVER-AUTHORED, whole. Undefined means the server has not answered yet. */
  readonly figure: LifecycleFigure | undefined;
  readonly tone: CensusTone;
  readonly noteTone: CensusNoteTone;
}) {
  return (
    <Card padding="none" className="p-9">
      {props.figure === undefined ? (
        <span data-stat-unanswered className="text-meta leading-close text-ink-faint">
          The server has not said.
        </span>
      ) : (
        <div className="flex flex-col gap-3">
          <span className="text-label font-semibold leading-flat text-ink-faint">
            {props.figure.label}
          </span>
          {/* The unit noun is the prototype's, pluralised — all four count orders. */}
          <span
            data-stat-value={props.figure.value}
            className={cx(
              "text-title font-bold leading-flat tabular-nums",
              FIGURE_TONE[props.tone],
            )}
          >
            {props.figure.value} {props.figure.value === 1 ? "order" : "orders"}
          </span>
          <span className={cx("text-meta leading-close", NOTE_TONE[props.noteTone])}>
            {props.figure.note}
          </span>
        </div>
      )}
    </Card>
  );
}
