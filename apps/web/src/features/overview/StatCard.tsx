import { Card, cx } from "../../components/ui";

/**
 * One census card. The prototype's third line — a note under the figure — has
 * no member on `LifecycleResponse` and is not invented. That refusal, and the
 * four labels this card carries instead of the prototype's, are ruled on by
 * `docs/frontend/design-2026-08/CONFLICT-overview-stats.md` §5.
 */
const FIGURE_TONE = {
  primary: "text-ink-primary",
  secondary: "text-ink-secondary",
  attend: "text-state-attend",
  halt: "text-state-halt",
} as const;

type StatTone = keyof typeof FIGURE_TONE;

export function StatCard(props: {
  readonly label: string;
  /** SERVER-COUNTED. Undefined means the server has not answered yet. */
  readonly value: number | undefined;
  readonly tone: StatTone;
}) {
  return (
    <Card padding="none" className="p-9">
      <div className="flex flex-col gap-3">
        <span className="text-label font-semibold leading-flat text-ink-faint">
          {props.label}
        </span>
        {props.value === undefined ? (
          <span data-stat-unanswered className="text-meta leading-close text-ink-faint">
            The server has not said.
          </span>
        ) : (
          /* The unit noun is the prototype's, pluralised — all four count orders. */
          <span
            data-stat-value={props.value}
            className={cx(
              "text-title font-bold leading-flat tabular-nums",
              FIGURE_TONE[props.tone],
            )}
          >
            {props.value} {props.value === 1 ? "order" : "orders"}
          </span>
        )}
      </div>
    </Card>
  );
}
