import { Card } from "../../components/ui";

/**
 * ONE STAT CARD — design §Screens 2: "label 11px grey, value 28px, note 13px —
 * NO INVENTED METRICS."
 *
 * ══ `value` IS OPTIONAL, AND ABSENT IS NOT ZERO ════════════════════════════
 *
 * This is the same rule `OrderFieldsResponse.census` states on the wire
 * (`endpoints.ts:163-167`): "OPTIONAL, and absent is not zero — it is 'the
 * server did not say'. The strip must print the SILENCE rather than fill it
 * in, which is the whole point of moving these numbers off the client."
 *
 * So an undefined value renders as an em-rule-free sentence saying the server
 * has not answered, never as `0` and never as a skeleton bar that implies a
 * number is on its way. On a screen whose subject is how much work is
 * outstanding, a `0` nobody sent is the most expensive possible wrong answer.
 *
 * There is NO arithmetic here and no prop that would permit any: the component
 * takes a number and prints it. A percentage, a delta, a "since last week" or
 * a rate would each be the browser deciding something (hard rule 3), and §4.5
 * means the rate never may exist at all.
 */
export function StatCard(props: {
  readonly label: string;
  /** SERVER-COUNTED. Undefined means the server has not answered yet. */
  readonly value: number | undefined;
  readonly note: string;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-4">
        <span className="text-label font-bold uppercase leading-flat tracking-caps text-ink-faint">
          {props.label}
        </span>
        {props.value === undefined ? (
          <span
            data-stat-unanswered
            className="text-meta leading-close text-ink-faint"
          >
            The server has not said.
          </span>
        ) : (
          // Rule 3: a count is data, so it is mono. `tabular-nums` so four
          // cards in a row line their figures up on one column.
          <span
            data-stat-value={props.value}
            className="font-mono text-title font-semibold leading-flat tabular-nums text-ink-primary"
          >
            {props.value}
          </span>
        )}
        <span className="text-meta leading-close text-ink-secondary">
          {props.note}
        </span>
      </div>
    </Card>
  );
}
