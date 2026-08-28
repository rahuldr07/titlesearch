import type { Rule } from "@titlepipe/contract";
import { Button, Card, CardBody, CardHeader, Empty } from "../../components/ui";
import { RulePill } from "../../entities/rule/RulePill";
import { RuleEffect } from "../../entities/rule/RuleEffect";
import { ContractGap } from "../../entities/contract/ContractGap";

/**
 * RULE CANDIDATES — design §Screens 10's second tab: "approve → rule appears in
 * Settings catalog as PENDING; reject → recorded."
 *
 * ══ THE DESIGN'S "APPROVE" IS NOT THE ENGINEER GATE, AND CONFLATING THEM
 *    WOULD MAKE A PENDING RULE BIND ═══════════════════════════════════════
 *
 * Read the design's own sentence: approving puts the rule in the catalog AS
 * PENDING. So "approve" is the act that CREATES a candidate, and that act
 * already happened — it is `POST /api/escalations/{id}/resolve` with a draft
 * (handlers.ts:1487-1500), which lands the rule `pending`. Every row on this
 * tab is the result of an approval, not a thing awaiting one.
 *
 * What is left is the ENGINEER GATE: `POST /api/rules/{id}/confirm`
 * (handlers.ts:1410), held by `engineer`/`admin` (authz.ts:105), which is the
 * only thing in the entire contract that can turn `pending` into `live`. It is
 * a different act by a different role, and `INVARIANTS:38` is exactly the
 * distance between them.
 *
 * ══ ROLE 42/43: THE CONFIRM BUTTON IS ABSENT WITHOUT THE GRANT ═════════════
 *
 * A senior standing here sees the candidates and no way to confirm one, which
 * is true: they cannot. Not a dimmed button with an explanation — see
 * `EscalationsScreen` for the design/contract collision this resolves.
 */
export function RuleCandidates({
  rules,
  canConfirm,
  onConfirm,
  confirming,
}: {
  readonly rules: readonly Rule[];
  readonly canConfirm: boolean;
  readonly onConfirm: (ruleId: string) => void;
  readonly confirming: boolean;
}) {
  const candidates = rules.filter((rule) => rule.status === "pending");

  return (
    <div className="flex flex-col gap-12">
      {/*
       * The prototype's right pane opens on a kicker capsule, the pane's own
       * heading, and one sentence saying what PENDING means. The sentence is
       * rewritten to the contract's actor: the prototype says "verified by an
       * Administrator", `authz.ts:105` says `engineer`/`admin`.
       */}
      <header className="flex flex-col items-start gap-4">
        <span className="rounded-pill border border-state-attend-border bg-state-attend-surface px-5 py-2 font-sans text-label leading-flat font-semibold text-state-attend">
          Continuous rule learning
        </span>
        <h1 className="font-sans text-title leading-tight font-bold text-ink-primary">
          Rule candidate review
        </h1>
        <p className="font-sans text-meta leading-body font-medium text-ink-muted">
          A candidate is non-blocking until an engineer confirms it.
        </p>
      </header>

      <Card padding="none">
        <CardHeader>Candidates awaiting the engineer gate</CardHeader>
        <CardBody className="flex flex-col gap-10">
          {candidates.length === 0 ? (
            <Empty
              title="No candidates"
              reason="Every rule in the book is live or retired. A candidate appears here when a cluster is resolved with a drafted rule."
            />
          ) : (
            candidates.map((rule) => (
              <div
                key={rule.id}
                data-testid={`candidate-${rule.id}`}
                className="flex flex-col gap-6 border-b border-line-subtle pb-10 last:border-b-0 last:pb-0"
              >
                <RulePill code={rule.code} status={rule.status} />
                <p className="font-sans text-body leading-body text-ink-primary">
                  {rule.text}
                </p>
                <RuleEffect code={rule.code} status={rule.status} />
                {canConfirm && (
                  <div>
                    <Button
                      data-testid={`confirm-${rule.id}`}
                      variant="secondary"
                      disabledBecause={
                        confirming ? "Sending — the server has not answered yet." : null
                      }
                      onPress={() => onConfirm(rule.id)}
                    >
                      Confirm — make this bind
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </CardBody>
      </Card>

      {/*
       * The design's other half. `reject → recorded` needs somewhere to record
       * it and something to record; neither exists.
       */}
      <ContractGap
        drawn="Reject → recorded (design §Screens 10, Rule Candidates tab)"
        has={
          <>
            The contract has no reject endpoint. `RuleStatus` (enums.ts:72) is
            `live | pending | retired`, and `retired` means a rule that USED to
            bind — writing a never-confirmed draft into it would put a rule that
            never bound into the same bucket as one that did, and the catalog
            could no longer tell a withdrawn candidate from a superseded rule.
          </>
        }
        needs={
          <>
            Either a fourth `RuleStatus` member for a refused draft, or a
            `POST /api/rules/{"{id}"}/reject` recording a rejector and a reason
            alongside `rule.confirm` (authz.ts:105). Until then, an unconfirmed
            candidate simply stays pending and inert, which is honest and is not
            what the design drew.
          </>
        }
      />
    </div>
  );
}
