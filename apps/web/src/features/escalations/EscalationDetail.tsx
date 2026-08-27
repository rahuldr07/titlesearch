import type { Escalation, Rule } from "@titlepipe/contract";
import { Card, CardBody, CardHeader } from "../../components/ui";
import { EscalationCard } from "../../entities/rule/EscalationCard";
import { RulePill } from "../../entities/rule/RulePill";
import { RuleEffect } from "../../entities/rule/RuleEffect";
import { ContractGap } from "../../entities/contract/ContractGap";
import { ResolveCard } from "./ResolveCard";

/**
 * ONE CLUSTER, AND WHAT CAN HONESTLY BE SHOWN ABOUT IT.
 *
 * Design §Screens 10 draws a detail pane with a docket excerpt on paper (the
 * debtor name in a citation box) and a debtor-vs-owner comparison grid. Both
 * are drawn from evidence, and an `Escalation` (entities.ts:166-175) carries no
 * evidence: a cluster path, the order ids, the question, and the resolution
 * triple. There is no party, no docket text, no page reference on it.
 *
 * Transcribing those boxes would mean inventing a debtor. That is the failure
 * root AGENTS.md names — "never emit a value you can't cite" — and it is worse
 * here than usual, because a comparison grid exists precisely to be READ AS
 * EVIDENCE by the person deciding whether two names are the same human.
 *
 * So `ContractGap` says so where the boxes would be.
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

  return (
    <div className="flex flex-col gap-12">
      <EscalationCard escalation={escalation} />

      <ContractGap
        drawn="Docket excerpt on paper with the boxed debtor name, and the debtor-vs-owner comparison grid"
        has={
          <>
            `Escalation` (entities.ts:166-175) carries `field_path_cluster`,
            `order_ids`, `question`, `resolution`, `rule_id`, `resolved_by` —
            and no party, no docket text and no page citation. `PagesResponse`
            (endpoints.ts:640) holds page text per ORDER, but nothing on the
            escalation says which page or which line the hit is on.
          </>
        }
        needs={
          <>
            A citation on the escalation — an instrument or page-and-line
            reference of the kind `Field.source_line_coords` already carries —
            so the excerpt can be quoted rather than composed, and the two names
            put side by side can each be attributed.
          </>
        }
      />

      {/* Settled: what settled it, and whether that thing binds. */}
      {escalation.rule_id !== null && settledBy !== undefined ? (
        <Card padding="none">
          <CardHeader>Settled</CardHeader>
          <CardBody className="flex flex-col gap-6">
            <p className="font-sans text-meta leading-close text-ink-secondary">
              Ruled by {escalation.resolved_by ?? "an unnamed actor"} · rests on{" "}
              <RulePill code={settledBy.code} status={settledBy.status} />
            </p>
            {/*
             * The stamp says what the rule is DOING, not merely that a
             * resolution was recorded. A cluster resolved onto a pending rule
             * is settled on paper and inert in the pipeline, and the reader
             * has to be able to see that difference.
             */}
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
    </div>
  );
}
