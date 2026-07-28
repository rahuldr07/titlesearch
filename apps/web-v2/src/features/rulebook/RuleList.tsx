import type { Rule } from "@titlepipe/contract";
import { Chip } from "../../shared/ui/Chip";
import { cn } from "../../shared/ui/classNames";
import { statusTone, statusLabel } from "./ruleStatus";

/**
 * The left rail. One row per rule, and the row shows the four things that
 * decide whether you need to open it: which rule, whether it is in force, where
 * it came from, and what it says.
 *
 * THE STATUS CHIP IS NEVER OPTIONAL. A rule row without it reads as policy, and
 * the whole point of this book is that half of it is not policy yet. It sits
 * beside the code rather than at the end of the row so it cannot be truncated
 * away on a narrow rail.
 *
 * CONTRACT GAP: the design's second chip is the provenance tag (RULED /
 * DERIVED / OPEN / CONFLICT). `Rule` carries `origin` — where the rule came
 * from, e.g. an escalation or a complaint — which is related but not the same
 * axis, so it is shown as itself and labelled as origin, not restyled to look
 * like a provenance tag it is not.
 *
 * CONTRACT GAP: the design's `{{ r.changed }}` — the last-changed date and who
 * changed it — has no field on `Rule`. `confirmed_by` is the closest, and it
 * only answers "who", so the row says only what it can cite.
 */
export function RuleList({
  rules,
  selected,
  onSelect,
}: {
  rules: readonly Rule[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  if (rules.length === 0) {
    return (
      <p className="text-base text-ink-secondary">
        No rules under this filter. The book is not empty — the filter is.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {rules.map((rule) => (
        <li key={rule.id}>
          <button
            type="button"
            data-testid={`rule-row-${rule.code}`}
            aria-current={rule.id === selected}
            onClick={() => onSelect(rule.id)}
            className={cn(
              "flex w-full flex-col gap-2 rounded-9 border-(length:--stroke-emphasis) p-7 text-left",
              rule.id === selected
                ? "border-action bg-action-surface"
                : "border-line-strong bg-surface-panel",
            )}
          >
            <span className="flex flex-wrap items-center gap-4">
              <span className="font-mono text-sm font-semibold text-ink-primary">
                {rule.code}
              </span>
              <Chip tone={statusTone(rule.status)} size="micro" bordered>
                {statusLabel(rule.status)}
              </Chip>
              <Chip tone="neutral" size="micro" bordered>
                {rule.origin}
              </Chip>
            </span>

            <span className="text-base leading-close text-ink-primary">{rule.text}</span>

            <span className="text-xs text-ink-muted">
              {rule.jurisdiction_scope ?? "All jurisdictions"} · v{rule.version}
              {rule.confirmed_by === null ? "" : ` · ${rule.confirmed_by}`}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
