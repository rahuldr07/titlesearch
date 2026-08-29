import type { Escalation, Rule } from "@titlepipe/contract";
import { Card, CardBody, CardHeader } from "../../components/ui";
import { OrderRef } from "../../entities/order/OrderRef";
import { RulePill } from "../../entities/rule/RulePill";
import { RuleEffect } from "../../entities/rule/RuleEffect";
import { ContractGap } from "../../entities/contract/ContractGap";
import { ResolveCard } from "./ResolveCard";

/**
 * ONE CLUSTER, AND WHAT CAN HONESTLY BE SHOWN ABOUT IT.
 *
 * The prototype's right pane is a kicker capsule ("Order 4176034-1 · Judgments
 * & Liens"), the escalation's own title as the heading, a quiet attribution
 * line, then a context card and a determination card. That shape is kept, with
 * the cluster path where the prototype has a section name. Its attribution
 * ("Escalated by Examiner D. Okafor · 3 hours ago") is NOT transcribed:
 * `Escalation` has no raiser and no timestamp, and `INVARIANTS:23` refuses
 * elapsed time. `resolved_by` is real, so it prints.
 *
 * ══ THE EVIDENCE BOXES ARE A GAP, NOT A DRAWING ════════════════════════════
 *
 * Design §Screens 10 draws a docket excerpt on paper and a debtor-vs-owner
 * comparison grid. Both are drawn from evidence, and an `Escalation`
 * (entities.ts:166-175) carries none. Transcribing them would mean inventing a
 * debtor — the failure AGENTS.md names, and worse here than usual: a comparison
 * grid exists precisely to be READ AS EVIDENCE by whoever decides whether two
 * names are the same human.
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
  /**
   * `null` when the reader does not hold `escalation.resolve`. NOT a disabled
   * flag: `INVARIANTS:42-43` make a role-locked affordance ABSENT, so the
   * determination card is not rendered at all and there is nothing to dim.
   */
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

        {escalation.resolved_by !== null && (
          <p className="font-sans text-meta leading-body font-medium text-ink-muted">
            Ruled by {escalation.resolved_by}
          </p>
        )}
      </header>

      <Card padding="none">
        <CardHeader>The cluster, and what is missing from it</CardHeader>
        <CardBody className="flex flex-col gap-8">
          {escalation.resolution !== null && (
            <p className="font-sans text-body leading-body text-ink-primary">
              {escalation.resolution}
            </p>
          )}

          {/* `INVARIANTS:36`, §0.5 MANDATORY: an escalation with a `resolution`
              and a null `rule_id` is NOT rendered as resolved — a UI that draws
              it settled has performed the resolution the server refused. */}
          {!resolvedByRule && (
            <p
              data-refusal="no-rule"
              className="rounded-sm border border-state-halt-border bg-state-halt-surface px-6 py-4 font-sans text-meta leading-close text-state-halt"
            >
              Open. A ruling alone is not a resolution — this closes when a rule is
              cited or drafted.
            </p>
          )}
          <ContractGap
            drawn="Docket excerpt on paper with the boxed debtor name, and the debtor-vs-owner comparison grid"
            has={
              <>
                `Escalation` (entities.ts:166-175) carries `field_path_cluster`,
                `order_ids`, `question`, `resolution`, `rule_id`, `resolved_by` —
                and no party, no docket text and no page citation. `PagesResponse`
                (endpoints.ts:640) holds page text per ORDER, but nothing says
                which page or which line the hit is on.
              </>
            }
            needs={
              <>
                A citation on the escalation — an instrument or page-and-line
                reference of the kind `Field.source_line_coords` already carries —
                so the excerpt can be quoted rather than composed.
              </>
            }
          />
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
            {/* The stamp says what the rule is DOING: settled on paper is not
                the same as binding in the pipeline. */}
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
      ) : null}
    </article>
  );
}
