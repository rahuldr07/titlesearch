import type { Rule } from "@titlepipe/contract";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { statusLabel, statusTone } from "./ruleStatus";
import { RuleLifecycle } from "./RuleLifecycle";
import { RuleFacts } from "./RuleFacts";
import { ResolveCard } from "./ResolveCard";
import { ConflictCard } from "./ConflictCard";
import { ImpactPreview } from "./ImpactPreview";
import { ConfirmBlock } from "./ConfirmBlock";
import { RetireBlock } from "./RetireBlock";
import { VersionLog } from "./VersionLog";

/**
 * One rule, in full: what it says, where it is in its life, what stands between
 * it and being applied, and what happened to it before now.
 *
 * THE PANELS BELOW THE FACTS ARE ORDERED BY WHAT BLOCKS WHAT. Objections first
 * (unresolved question, collision), then the evidence you would confirm against
 * (impact preview), then the act itself. Putting the confirm control above its
 * own objections is how somebody confirms a rule they have not read the
 * problems with.
 *
 * WHICH OBJECTIONS APPLY IS DECIDED BY THE CITATION, because that is the only
 * blocking signal on the wire. `source_doc_ref === null` is a rule with no
 * authority behind it — the design's OPEN state, arrived at from a field the
 * contract actually carries rather than from a tag it does not.
 *
 * CONTRACT GAP: the design branches on a provenance tag (RULED / DERIVED /
 * OPEN / CONFLICT) that `Rule` does not carry, and on a counterpart rule id for
 * conflicts that nothing on the wire supplies. An uncited pending rule
 * therefore shows BOTH blocking panels — the client cannot tell which of the
 * two objections is the real one, and picking one at random would be worse than
 * showing both with their fixtures labelled.
 */
export function RuleDetail({
  rule,
  mayConfirm,
  mayAdminister,
  confirmPending,
  confirmError,
  onConfirm,
}: {
  rule: Rule;
  /** Status-gated: may this role confirm THIS rule, in the state it is in. */
  mayConfirm: boolean;
  /** Role-only: engineer or admin, for acts the authz table has no row for. */
  mayAdminister: boolean;
  confirmPending: boolean;
  confirmError: string | null;
  onConfirm: () => void;
}) {
  const uncited = rule.source_doc_ref === null;

  return (
    <Card size="emphasis" data-testid={`rule-detail-${rule.code}`}>
      <CardHeader className="flex-col items-stretch gap-0 py-7">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-mono text-md font-semibold text-ink-primary">
            {rule.code}
          </span>
          <Chip
            tone={statusTone(rule.status)}
            size="sm"
            bordered
            data-testid="rule-status-chip"
          >
            {statusLabel(rule.status)}
          </Chip>
          <Chip tone="neutral" size="sm" bordered>
            {rule.origin}
          </Chip>
          <span className="ml-auto font-mono text-tiny text-ink-muted">v{rule.version}</span>
        </div>

        <p className="mt-4 text-lg leading-close font-semibold text-ink-primary">
          {rule.text}
        </p>

        <RuleLifecycle status={rule.status} />
      </CardHeader>

      <CardBody className="flex flex-col gap-7">
        <RuleFacts rule={rule} />

        {rule.status === "pending" ? (
          <>
            {uncited ? <ResolveCard mayWithdraw={mayAdminister} /> : null}
            {uncited ? <ConflictCard code={rule.code} outcome={rule.text} /> : null}
            {uncited ? null : <ImpactPreview />}
            <ConfirmBlock
              mayConfirm={mayConfirm}
              pending={confirmPending}
              error={confirmError}
              onConfirm={onConfirm}
            />
          </>
        ) : null}

        {rule.status === "live" ? <RetireBlock mayRetire={mayAdminister} /> : null}

        <VersionLog />
      </CardBody>
    </Card>
  );
}
