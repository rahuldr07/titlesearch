import type { LifecycleFigure } from "@titlepipe/contract";
import { Card, cx } from "../../components/ui";
import type { CensusNoteTone, CensusTone } from "../../entities/lifecycle/census";

/**
 * One census card. `LifecycleFigure` carries label, value and note off the
 * wire, and all three are printed verbatim — nothing on this card is
 * authored or computed in the browser.
 */
const FIGURE_TONE = {
  primary: "text-ink-primary",
  secondary: "text-ink-secondary",
  attend: "text-state-attend",
  settled: "text-state-settled",
} as const satisfies Record<CensusTone, string>;

/* The settled note is drawn at weight 600; the attend note plain. */
const NOTE_TONE = {
  muted: "text-ink-muted",
  attend: "text-state-attend",
  settled: "font-semibold text-state-settled",
} as const satisfies Record<CensusNoteTone, string>;

export function StatCard(props: {
  /** Server-authored, whole. Undefined means the server has not answered yet. */
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
          {/* The unit noun, pluralised — all four figures count orders. */}
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
