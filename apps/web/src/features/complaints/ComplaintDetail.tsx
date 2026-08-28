import type { Complaint, Rule } from "@titlepipe/contract";
import { Card, CardBody, CardHeader } from "../../components/ui";
import { DefectCard } from "./DefectCard";
import { RulePill } from "../../entities/rule/RulePill";
import { RuleEffect } from "../../entities/rule/RuleEffect";
import { ContractGap } from "../../entities/contract/ContractGap";
import { ResolveComplaintCard } from "./ResolveComplaintCard";

/**
 * ONE COMPLAINT, AND WHAT CAN HONESTLY BE SHOWN ABOUT IT.
 *
 * The defect pair is `DefectCard`; this is the three things that can be said
 * AROUND it — what the record cannot tell you, what closed it, and the act that
 * would close it.
 *
 * ══ CLOSED IS READ OFF `rule_id`, NOT OFF `resolution` ═════════════════════
 *
 * `endpoints.ts:548`: the loop terminates in a RULE. A complaint carrying a
 * resolution and no rule is a fix somebody typed, not a closed loop, and
 * reading the state off the prose field would draw it as done.
 */
export function ComplaintDetail({
  complaint,
  rules,
  resolving,
  onResolve,
}: {
  readonly complaint: Complaint;
  readonly rules: readonly Rule[];
  readonly resolving: boolean;
  /**
   * `null` when the reader does not hold `complaint.resolve` (`authz.ts:117`,
   * `ops`/`admin`). NOT a disabled flag: `INVARIANTS:42-43` make a role-locked
   * affordance ABSENT, so the card is not rendered and there is nothing to dim.
   */
  readonly onResolve:
    | ((
        resolution: string,
        rule: { rule_id: string } | { draft: { text: string } },
        goldenOffer: boolean,
      ) => void)
    | null;
}) {
  const closedBy = rules.find((rule) => rule.id === complaint.rule_id);

  return (
    <div className="flex flex-col gap-10">
      <DefectCard complaint={complaint} />

      <ContractGap
        drawn="What the client actually wrote when they reported it"
        has={
          <>
            `CreateComplaintRequest` (endpoints.ts:509) accepts a `description`,
            and `Complaint` (entities.ts:237-247) has no member to read it back
            from — handlers.ts:1032 drops it on the floor. The field is
            WRITE-ONLY, so the sentence a client sent is unreadable the moment it
            is filed. There is no reporter and no filed-at either.
          </>
        }
        needs={
          <>
            `description`, a reporter and a filed-at on the `Complaint` entity —
            the three the `Bug` shape (entities.ts:176-185) already models with
            `description` and `upstream_source`.
          </>
        }
      />

      {complaint.rule_id !== null && closedBy !== undefined ? (
        <Card padding="none">
          <CardHeader>Closed</CardHeader>
          <CardBody className="flex flex-col gap-6">
            <p className="font-sans text-meta leading-body text-ink-secondary">
              {complaint.resolution ?? "The server recorded no words for the fix."}
            </p>
            <p className="font-sans text-meta leading-close text-ink-secondary">
              Rests on <RulePill code={closedBy.code} status={closedBy.status} />
              {complaint.golden_offer_accepted === true
                ? " · kept as a permanent golden case"
                : ""}
            </p>
            {/* What the rule is DOING. A complaint closed onto a pending rule is
                closed on paper and inert in the pipeline (INVARIANTS:38). */}
            <RuleEffect code={closedBy.code} status={closedBy.status} />
          </CardBody>
        </Card>
      ) : onResolve !== null ? (
        <Card padding="none">
          <CardHeader>The resolution</CardHeader>
          <CardBody>
            <ResolveComplaintCard rules={rules} pending={resolving} onResolve={onResolve} />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
