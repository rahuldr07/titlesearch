import type { Escalation } from "@titlepipe/contract";
import type { ReactNode } from "react";
import { cx } from "../../components/ui/cx";
import { OrderRef } from "../order/OrderRef";

/**
 * AN ESCALATION, AND THE FURNITURE THAT IS DELIBERATELY MISSING.
 *
 * `INVARIANTS:39`: "The escalation inbox has NO TRIAGE FURNITURE — no category,
 * no priority, no assignee. Just the rule." The contract agrees by omission:
 * `Escalation` (`entities.ts:166-175`) carries a question, the orders it spans,
 * a resolution and a rule id, and nothing else. There is no priority to render
 * and there must not be one to sort by.
 *
 * `INVARIANTS:36` is `§0.5 MANDATORY` and is what the footer draws: "escalation
 * resolution is REFUSED without a rule. A ruling alone is not a resolution."
 * So an escalation with a `resolution` and a null `rule_id` is NOT rendered as
 * resolved. It is rendered as still open, with the ruling shown and the missing
 * rule named — because a UI that draws it as settled has, on screen, performed
 * the resolution the server refused.
 *
 * `INVARIANTS:37`: citing an existing rule is one of exactly TWO paths, the
 * other being drafting one (which lands PENDING and inert — `RulePill`). The
 * actions are handed in rather than built here, so this card cannot grow a
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
   * NOT a derivation of state — a restatement of the mandatory rule. `rule_id`
   * is the server's own field; this reads it, and nothing about the card's
   * appearance depends on `resolution` alone.
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
      <span className="font-mono text-label leading-flat tracking-caps text-ink-muted uppercase">
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
