import type { Reconciliation, ReconciliationRulingRequest, Rule } from "@titlepipe/contract";
import { Card, CardBody, CardHeader } from "../../components/ui";
import { RulePill } from "../../entities/rule/RulePill";
import { RuleEffect } from "../../entities/rule/RuleEffect";
import { SeatReadings } from "./SeatReadings";
import { RulingCard } from "./RulingCard";

/**
 * ONE DIVERGENCE: the two readings, then either the record of how it was ruled
 * or the act that would rule it.
 *
 * ══ RULED IS `ruled_by` ════════════════════════════════════════════════════
 *
 * Never `ruling_value`, which is nullable BY DESIGN — "no value belongs here"
 * is a ruling. handlers.ts:1299 checks both before refusing a replay; this
 * reads the one that cannot be confused with a value.
 *
 * ══ THE MINTED RULE'S STATUS IS THE SERVER'S ═══════════════════════════════
 *
 * A ruling may carry a general-rule offer, and the rule it mints lands
 * `pending` (handlers.ts:1308-1318). `INVARIANTS:38`: it "renders visibly
 * inert — it cannot affect the pipeline until an engineer confirms." So the
 * rule is looked up in the RULEBOOK and its own `status` is drawn. Nothing here
 * assumes a rule born of a ruling is pending; if an engineer has since
 * confirmed it, the stamp says so, because it reads the server's field.
 */
export function DivergenceDetail({
  divergence,
  rules,
  ruling,
  onRule,
}: {
  readonly divergence: Reconciliation;
  readonly rules: readonly Rule[];
  readonly ruling: boolean;
  /**
   * `null` when the reader does not hold `reconciliation.rule` (`authz.ts:113`,
   * `senior`/`admin`). NOT a disabled flag: `INVARIANTS:42-43` make a
   * role-locked affordance ABSENT, so the form is not rendered at all.
   */
  readonly onRule: ((body: ReconciliationRulingRequest) => void) | null;
}) {
  const minted = rules.find((rule) => rule.id === divergence.general_rule_id);

  return (
    <div className="flex flex-col gap-10">
      <Card padding="none">
        <CardHeader>
          <span>The two blind readings</span>
          <span className="font-mono text-label leading-flat text-ink-faint">
            {divergence.path}
          </span>
        </CardHeader>
        <CardBody>
          <SeatReadings divergence={divergence} />
        </CardBody>
      </Card>

      {divergence.ruled_by !== null ? (
        <Card padding="none">
          <CardHeader>Ruled</CardHeader>
          <CardBody className="flex flex-col gap-6">
            <p className="font-sans text-meta leading-close text-ink-secondary">
              Reads{" "}
              {divergence.ruling_value === null ? (
                "as nothing — the senior ruled that no value belongs here."
              ) : (
                <span className="font-mono text-body text-ink-primary">
                  {divergence.ruling_value}
                </span>
              )}
            </p>
            {/* Rule 3: a citation is data, and it is the thing the ruling rests
                on — printed as given, never paraphrased. */}
            <p className="font-mono text-meta leading-close text-ink-secondary">
              {divergence.citation ?? "no citation of record"}
            </p>
            {divergence.reason !== null && (
              <p className="font-sans text-meta leading-body text-ink-secondary">
                {divergence.reason}
              </p>
            )}
            <p className="font-sans text-meta leading-close text-ink-secondary">
              Ruled by {divergence.ruled_by}
              {minted !== undefined && (
                <>
                  {" · offered "}
                  <RulePill code={minted.code} status={minted.status} />
                </>
              )}
            </p>
            {minted !== undefined && (
              <RuleEffect code={minted.code} status={minted.status} />
            )}
          </CardBody>
        </Card>
      ) : onRule !== null ? (
        <Card padding="none">
          <CardHeader>The ruling</CardHeader>
          <CardBody>
            <RulingCard divergence={divergence} pending={ruling} onRule={onRule} />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
