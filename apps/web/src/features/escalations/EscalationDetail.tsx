import type { Escalation, Rule } from "@titlepipe/contract";
import { Card, CardBody, CardHeader } from "../../components/ui";
import { OrderRef } from "../../entities/order/OrderRef";
import { RulePill } from "../../entities/rule/RulePill";
import { RuleEffect } from "../../entities/rule/RuleEffect";
import { ResolveCard } from "./ResolveCard";
import { DocketExcerpt, IdentityGrid, LockedDetermination } from "./EvidenceBlocks";

/**
 * One cluster with its evidence, every block read off the server's
 * `Escalation` — the server quotes the record, and the age is a served label,
 * never a tick. Nothing here composes evidence. A seat without
 * `escalation.resolve` sees the determination visible but disabled; the
 * refusal itself stays the server's (403), and resolve-without-a-rule stays
 * refused for every seat.
 */
export function EscalationDetail({
  escalation,
  rules,
  resolving,
  onResolve,
}: {
  readonly escalation: Escalation;
  readonly rules: readonly Rule[];
  readonly resolving: boolean;
  /** `null` when the reader does not hold `escalation.resolve` — the card
   * then renders disabled-with-hint, never absent. */
  readonly onResolve:
    | ((ruling: string, rule: { rule_id: string } | { draft: { text: string } }) => void)
    | null;
}) {
  const settledBy = rules.find((rule) => rule.id === escalation.rule_id);
  const resolvedByRule = escalation.rule_id !== null;

  return (
    <article
      data-escalation={escalation.id}
      data-resolved-by-rule={resolvedByRule}
      className="flex flex-col gap-12"
    >
      <header className="flex flex-col items-start gap-4">
        <span className="flex flex-wrap items-center gap-4 rounded-pill border border-action-border-strong bg-action-surface px-5 py-2">
          <span className="font-sans text-label leading-flat font-semibold text-ink-secondary">
            {escalation.order_ids.length === 1 ? "Order" : "Orders"}
          </span>
          {escalation.order_ids.map((id) => (
            <OrderRef key={id} orderRef={id} />
          ))}
          <span aria-hidden className="font-sans text-label leading-flat text-ink-faint">
            ·
          </span>
          <span className="font-mono text-label leading-flat text-ink-secondary">
            {escalation.field_path_cluster}
          </span>
        </span>

        <h1 className="font-sans text-title leading-tight font-bold text-ink-primary">
          {escalation.question}
        </h1>

        {escalation.resolved_by !== null ? (
          <p className="font-sans text-meta leading-body font-medium text-ink-muted">
            Ruled by {escalation.resolved_by}
          </p>
        ) : escalation.raised_by !== null ? (
          <p className="font-sans text-meta leading-body font-medium text-ink-muted">
            {`Escalated by ${escalation.raised_by}`}
            {escalation.age !== null && ` · ${escalation.age}`}
          </p>
        ) : null}
      </header>

      <Card padding="none">
        <CardHeader>Extraction context &amp; legal evidence</CardHeader>
        <CardBody className="flex flex-col gap-8">
          {escalation.context !== null && (
            <p className="font-sans text-body leading-body text-ink-primary">
              {escalation.context}
            </p>
          )}

          {escalation.resolution !== null && (
            <p className="font-sans text-body leading-body text-ink-primary">
              {escalation.resolution}
            </p>
          )}

          {escalation.excerpt !== null && (
            <DocketExcerpt
              escalation={escalation}
              orderId={escalation.order_ids[0] ?? null}
            />
          )}

          {escalation.identity !== null && (
            <IdentityGrid identity={escalation.identity} />
          )}

          {/* An escalation with a `resolution` and a null `rule_id` is not
              rendered as resolved — a UI that draws it settled has performed
              the resolution the server refused. */}
          {!resolvedByRule && (
            <p
              data-refusal="no-rule"
              className="rounded-sm border border-state-halt-border bg-state-halt-surface px-6 py-4 font-sans text-meta leading-close text-state-halt"
            >
              Open. A ruling alone is not a resolution — this closes when a rule is
              cited or drafted.
            </p>
          )}
        </CardBody>
      </Card>

      {/* Settled: what settled it, and whether that thing binds. */}
      {resolvedByRule && settledBy !== undefined ? (
        <Card padding="none">
          <CardHeader>Settled</CardHeader>
          <CardBody className="flex flex-col gap-6">
            <p className="font-sans text-meta leading-close text-ink-secondary">
              Rests on <RulePill code={settledBy.code} status={settledBy.status} />
            </p>
            {/* Settled on paper is not the same as binding in the pipeline. */}
            <RuleEffect code={settledBy.code} status={settledBy.status} />
          </CardBody>
        </Card>
      ) : onResolve !== null ? (
        <Card padding="none">
          <CardHeader>The determination</CardHeader>
          <CardBody>
            <ResolveCard rules={rules} pending={resolving} onResolve={onResolve} />
          </CardBody>
        </Card>
      ) : (
        <LockedDetermination escalation={escalation} />
      )}
    </article>
  );
}
