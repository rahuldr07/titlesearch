import type { Escalation } from "@titlepipe/contract";
import type { ReactNode } from "react";
import { cx } from "../../components/ui";
import { OrderRef } from "../order/OrderRef";

/**
 * An escalation, with the triage furniture deliberately missing — no
 * category, no priority, no assignee; the contract agrees by omission.
 *
 * Escalation resolution is refused without a rule: an escalation with a
 * `resolution` and a null `rule_id` is not rendered as resolved but as
 * still open, with the ruling shown and the missing rule named — a UI that
 * draws it as settled has performed, on screen, the resolution the server
 * refused. There are exactly two resolution paths (cite a rule, draft one);
 * the actions are handed in rather than built, so this card cannot grow a
 * third.
 */
export type EscalationCardProps = {
  readonly escalation: Escalation;
  /** The two resolution paths, composed by the feature that owns them. */
  readonly actions?: ReactNode;
  readonly className?: string | undefined;
};

export function EscalationCard({ escalation, actions, className }: EscalationCardProps) {
  /*
   * Not a derivation of state — a restatement of the mandatory rule.
   * `rule_id` is the server's own field; nothing about the card's appearance
   * depends on `resolution` alone.
   */
  const resolvedByRule = escalation.rule_id !== null;

  return (
    <article
      data-escalation={escalation.id}
      data-resolved-by-rule={resolvedByRule}
      className={cx(
        "flex flex-col gap-6 rounded-lg border bg-surface-panel p-10",
        resolvedByRule ? "border-line-strong" : "border-state-halt-border",
        className,
      )}
    >
      <span className="font-mono text-label leading-flat text-ink-muted">
        {escalation.field_path_cluster}
      </span>

      <p className="font-sans text-subject leading-close text-ink-primary">
        {escalation.question}
      </p>

      {/* The orders it spans. A cluster is the unit; a single order is a case. */}
      <div className="flex flex-wrap items-center gap-4">
        {escalation.order_ids.map((id) => (
          <OrderRef key={id} orderRef={id} />
        ))}
      </div>

      {escalation.resolution !== null && (
        <p className="font-sans text-meta leading-close text-ink-secondary">
          {escalation.resolution}
        </p>
      )}

      {!resolvedByRule && (
        <p
          data-refusal="no-rule"
          className="rounded-sm border border-state-halt-border bg-state-halt-surface px-6 py-4 font-sans text-meta leading-close text-state-halt"
        >
          Open. A ruling alone is not a resolution — this closes when a rule is
          cited or drafted.
        </p>
      )}

      {actions !== undefined && <div className="flex items-center gap-6">{actions}</div>}
    </article>
  );
}
