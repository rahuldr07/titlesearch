import type { Escalation } from "@titlepipe/contract";
import { Empty, cx } from "../../components/ui";

/**
 * THE INBOX, DRAWN AS THE PROTOTYPE DRAWS IT.
 *
 * `reference-app.html` § `isEscalations`, `escList`: a 14px card on a 14px
 * radius, holding a mono order ref top-left and a status capsule top-right on
 * one baseline; the title in w600 underneath; then a quiet line naming the
 * actor and the section. Selected is the violet-bordered, violet-tinted card.
 *
 * `INVARIANTS:39` — no triage furniture: no category, no priority, no assignee,
 * and no sort control either, because every sort key a queue could offer is a
 * triage field the `Escalation` shape refuses to carry (entities.ts:166-175).
 * The order is the SERVER's array order, printed.
 *
 * ══ WHAT THE PROTOTYPE'S TOP-RIGHT CAPSULE HOLDS HERE ══════════════════════
 *
 * It draws an AGE there ("3h ago"), flipping to "settled" in green when the
 * query closes. There is no timestamp on an `Escalation` and `INVARIANTS:23`
 * refuses elapsed time besides, so the slot carries the thing the prototype's
 * own capsule turns into: the open/settled signal. Rule 6 still holds — that
 * capsule is the row's ONE status signal, which is why the ◆ mark that used to
 * prefix the question is gone rather than kept alongside it.
 *
 * `resolved` is read off `rule_id`, the server's field, which is also the
 * mandatory rule restated: a cluster with a ruling and no rule is NOT resolved
 * (`INVARIANTS:36`). Nothing here derives it from `resolution` alone.
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
                className={cx(
                  "rounded-lg px-4 py-1 font-mono text-label leading-flat font-bold",
                  resolved
                    ? "bg-state-settled-surface text-state-settled"
                    : "bg-surface-sunken text-ink-secondary",
                )}
              >
                {resolved ? "Settled" : "Open"}
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
              {escalation.resolved_by !== null && `Ruled by ${escalation.resolved_by} · `}
              <span className="font-mono">{escalation.field_path_cluster}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
