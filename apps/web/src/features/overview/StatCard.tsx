import { Card, cx } from "../../components/ui";

/**

 * ONE STAT CARD, drawn to the prototype's geometry. Measured out of

 * `reference-app.html` (the `queueStats` block and the `<sc-for>` that renders it)

 * rather than paraphrased out of the README, which is how the previous version came to

 * say…

 */

/**

 * The prototype colours the figure per card — graphite for the two neutral censuses,

 * `#8A5B12` for the one that wants attention, `#2E6B4F` for the one that is a moment

 * of record. `tone` is that channel, and it is a STATIC property of the…

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
    <Card padding="tight">
      <div className="flex flex-col gap-3">
        {/* Rule 4: sentence case. 11px w600 grey, as the prototype draws it. */}
        <span className="text-label font-semibold leading-flat text-ink-faint">
          {props.label}
        </span>
        {props.value === undefined ? (
          <span data-stat-unanswered className="text-meta leading-close text-ink-faint">
            The server has not said.
          </span>
        ) : (
          /*
           * `tabular-nums` so four cards in a row line their figures up on one
           * column. The unit noun is the prototype's ("6 orders", not "6") and
           * is a fact about the figure rather than a claim about it — every one
           * of these four counts orders. Pluralised, because the prototype
           * prints "1 orders" and shipping its grammar bug is not fidelity.
           */
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
