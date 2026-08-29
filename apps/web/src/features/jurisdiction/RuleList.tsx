import type { JurisdictionRule } from "@titlepipe/contract";
import { Badge, Card, cx } from "../../components/ui";

/**
 * WHICH RULES BIND HERE, AND WHICH DO NOT.
 *
 * `applies` is read, never computed. A rule scoped to New York arrives with
 * `applies: false` and is drawn as such — it is not filtered out, because a
 * reviewer asking "why is this not reported?" needs to see the rule that is
 * sitting this one out.
 */
export function RuleList(props: {
  readonly rules: readonly JurisdictionRule[];
  readonly label: string;
}) {
  if (props.rules.length === 0) {
    return (
      <Card>
        <p className="text-meta leading-body text-ink-secondary">
          The server sent no rules for {props.label}. That is its answer, not a filter
          applied here.
        </p>
      </Card>
    );
  }

  return (
    <Card padding="none">
      <ul>
        {props.rules.map((rule) => (
          <li
            key={rule.id}
            data-rule-applies={String(rule.applies)}
            className="flex flex-col gap-4 border-b border-line-subtle px-12 py-8 last:border-b-0"
          >
            <div className="flex flex-wrap items-baseline gap-6">
              {/* Rule 3: a rule code is an identifier the reviewer will search for. */}
              <span
                className={cx(
                  "font-mono text-meta font-semibold leading-close",
                  rule.applies ? "text-ink-secondary" : "text-ink-muted",
                )}
              >
                {rule.code}
              </span>
              {rule.applies ? (
                <Badge tone="settled">In force here</Badge>
              ) : (
                <span className="text-label leading-flat text-ink-disabled">
                  Not in force here
                </span>
              )}
              {rule.scope_note !== null && (
                <span className="text-label leading-flat text-ink-faint">
                  {rule.scope_note}
                </span>
              )}
            </div>
            <p
              className={cx(
                "text-meta leading-body",
                rule.applies ? "text-ink-primary" : "text-ink-muted",
              )}
            >
              {rule.text}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
