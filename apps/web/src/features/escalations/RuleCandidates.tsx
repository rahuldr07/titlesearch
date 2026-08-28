import type { Rule } from "@titlepipe/contract";
import { Alert, Button, Card, CardBody, CardHeader, Empty } from "../../components/ui";
import { RulePill } from "../../entities/rule/RulePill";
import { RuleEffect } from "../../entities/rule/RuleEffect";

/**
 * Continuous rule learning — the design's Rule Candidates tab. The design's
 * "approve" has already happened: resolving a cluster with a draft lands the
 * rule PENDING. What is left is the engineer gate, POST /api/rules/{id}/confirm.
 */
export function RuleCandidates({
  rules,
  canConfirm,
  onConfirm,
  confirming,
  refusal,
}: {
  readonly rules: readonly Rule[];
  readonly canConfirm: boolean;
  readonly onConfirm: (ruleId: string) => void;
  readonly confirming: boolean;
  readonly refusal: string | null;
}) {
  const candidates = rules.filter((rule) => rule.status === "pending");

  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col items-start gap-4">
        <span className="rounded-pill border border-state-attend-border bg-state-attend-surface px-5 py-2 font-sans text-label leading-flat font-semibold text-state-attend">
          Continuous rule learning
        </span>
        <h1 className="font-sans text-title leading-tight font-bold text-ink-primary">
          Rule candidate review
        </h1>
        {/* The prototype says "an Administrator"; authz.ts:105 says engineer/admin. */}
        <p className="font-sans text-meta leading-body font-medium text-ink-muted">
          A candidate is non-blocking until an engineer confirms it.
        </p>
      </header>

      <Card padding="none">
        <CardHeader>Candidates awaiting the engineer gate</CardHeader>
        <CardBody className="flex flex-col gap-10">
          {/* The server's sentence, unedited (INVARIANTS:58-59). */}
          {refusal !== null && <Alert title="Refused" message={refusal} />}

          {candidates.length === 0 ? (
            <Empty
              title="No candidates"
              reason="Every rule in the book is live or retired. A candidate appears here when a cluster is resolved with a drafted rule."
            />
          ) : (
            candidates.map((rule) => (
              <Candidate
                key={rule.id}
                rule={rule}
                canConfirm={canConfirm}
                confirming={confirming}
                onConfirm={onConfirm}
              />
            ))
          )}
        </CardBody>
      </Card>

      <p
        data-testid="reject-absent"
        className="font-sans text-meta leading-body text-ink-muted"
      >
        The design&rsquo;s &ldquo;reject pattern&rdquo; is absent because no endpoint refuses a
        candidate — an unconfirmed one simply stays pending and inert.
      </p>
    </div>
  );
}

/** A pending rule, drawn as the not-in-force thing it is (INVARIANTS:38). */
function Candidate({
  rule,
  canConfirm,
  confirming,
  onConfirm,
}: {
  readonly rule: Rule;
  readonly canConfirm: boolean;
  readonly confirming: boolean;
  readonly onConfirm: (ruleId: string) => void;
}) {
  return (
    <article
      data-testid={`candidate-${rule.id}`}
      data-inert-rule="pending"
      className="flex flex-col gap-6 rounded-md border border-dashed border-state-attend-border bg-state-attend-surface p-8"
    >
      <RulePill code={rule.code} status={rule.status} />
      <p className="font-sans text-body leading-body text-ink-primary">{rule.text}</p>
      <RuleEffect code={rule.code} status={rule.status} />
      <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
        <Fact label="Origin" value={rule.origin} />
        <Fact label="Version" value={String(rule.version)} />
        {/* A null scope and a null confirmer are STATEMENTS, so they are said. */}
        <Fact
          label="Scope"
          value={rule.jurisdiction_scope ?? "every jurisdiction — unscoped"}
        />
        <Fact label="Confirmed by" value={rule.confirmed_by ?? "nobody yet"} />
        <Fact label="Source" value={rule.source_doc_ref ?? "no source document recorded"} />
      </dl>
      {canConfirm && (
        <div>
          <Button
            data-testid={`confirm-${rule.id}`}
            variant="primary"
            disabledBecause={
              confirming ? "Sending — the server has not answered yet." : null
            }
            onPress={() => {
              onConfirm(rule.id);
            }}
          >
            {rule.jurisdiction_scope === null
              ? "Confirm for every jurisdiction"
              : `Confirm for the ${rule.jurisdiction_scope} catalog`}
          </Button>
        </div>
      )}
    </article>
  );
}

function Fact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-sans text-label leading-flat font-bold text-ink-muted">{label}</dt>
      <dd className="font-sans text-label leading-close text-ink-secondary">{value}</dd>
    </div>
  );
}
