import type { Escalation } from "@titlepipe/contract";
import { Empty, cx } from "../../components/ui";

/**
 * The escalation inbox. No triage furniture — no category, priority, assignee,
 * or sort control; the order is the server's array order, printed. The age chip
 * is the server's finished label (`Escalation.age`), never a ticking clock
 * computed here; without a label it falls back to open/settled read off
 * `rule_id` — a cluster with a ruling and no rule is not resolved.
 */
export function EscalationQueue({
  escalations,
  selectedId,
  onSelect,
}: {
  readonly escalations: readonly Escalation[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}) {
  if (escalations.length === 0) {
    return (
      <Empty
        title="Nothing escalated"
        reason="No reviewer has raised a question that the rulebook does not already answer."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {escalations.map((escalation) => {
        const resolved = escalation.rule_id !== null;
        const selected = escalation.id === selectedId;
        const ref =
          escalation.order_ids.length === 1
            ? escalation.order_ids[0]
            : `${String(escalation.order_ids.length)} orders`;

        return (
          <button
            key={escalation.id}
            type="button"
            data-testid={`escalation-${escalation.id}`}
            data-cluster={escalation.field_path_cluster}
            data-resolved-by-rule={resolved}
            aria-current={selected}
            onClick={() => onSelect(escalation.id)}
            className={cx(
              "tp-state flex cursor-pointer flex-col gap-2 rounded-lg border p-7 text-left",
              selected
                ? "border-action-border bg-action-surface"
                : "border-line-strong bg-surface-panel hover:bg-surface-sunken",
            )}
          >
            <span className="flex items-baseline justify-between gap-4">
              <span className="font-mono text-label leading-flat font-bold text-ink-secondary">
                {ref}
              </span>
              <span
                data-testid={`escalation-age-${escalation.id}`}
                className={cx(
                  "rounded-lg px-4 py-1 font-mono text-label leading-flat font-bold",
                  resolved
                    ? "bg-state-settled-surface text-state-settled"
                    : "bg-surface-sunken text-ink-secondary",
                )}
              >
                {escalation.age ?? (resolved ? "settled" : "open")}
              </span>
            </span>

            <span
              className={cx(
                "font-sans text-meta leading-close text-ink-primary",
                !resolved && "font-semibold",
              )}
            >
              {escalation.question}
            </span>

            <span className="font-sans text-label leading-close font-medium text-ink-muted">
              {escalation.resolved_by !== null
                ? `Ruled by ${escalation.resolved_by} · `
                : escalation.raised_by !== null
                  ? `${escalation.raised_by} · `
                  : null}
              <span className="font-mono">{escalation.field_path_cluster}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
