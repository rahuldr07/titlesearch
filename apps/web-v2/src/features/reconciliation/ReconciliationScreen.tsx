import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { reconciliationQuery, useRuleDivergence } from "./queries";
import { DivergenceCard } from "./DivergenceCard";
import { Card, CardBody } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Chip } from "../../shared/ui/Chip";
import { ApiError } from "../../shared/api";

/**
 * RECONCILIATION — two typists read the same package blind, and where they
 * disagree a senior writes the answer down as law.
 *
 * EVERY RULING HERE IS PERMANENT GROUND TRUTH. This is not a backlog to clear:
 * an agreement between two independent readers needs no space and gets none,
 * and the disagreements — the only interesting part — get the whole screen.
 */
export function ReconciliationScreen() {
  const { orderId } = useParams({ from: "/reconciliation/$orderId" });
  const { data, isPending, isError } = useQuery(reconciliationQuery(orderId));
  const rule = useRuleDivergence(orderId);

  if (isError) return <p className="text-base text-state-halt-ink">Reconciliation unavailable.</p>;
  if (isPending) return <p className="text-base text-ink-secondary">Loading the divergences…</p>;

  const open = data.divergences.filter((d) => d.ruling_value === null);
  const ruled = data.divergences.filter((d) => d.ruling_value !== null);

  if (data.divergences.length === 0) {
    return (
      <Card data-testid="recon-empty">
        <CardBody className="flex flex-col gap-4">
          <Eyebrow variant="screen">Nothing to reconcile</Eyebrow>
          <p className="max-w-2xl text-base leading-body text-ink-secondary">
            No divergences are recorded against{" "}
            <code className="font-mono">{orderId}</code>. Either both passes
            agreed on every field, or this order has not been read twice yet.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Eyebrow variant="screen">Reconciliation</Eyebrow>
        <p className="font-mono text-xs text-ink-muted">
          {orderId} · {ruled.length} of {data.divergences.length} ruled
        </p>
        <p className="max-w-3xl text-base leading-body text-ink-secondary">
          Every ruling here is permanent ground truth — you are not clearing a
          backlog, you are writing law. Where both passes agreed, that is truth
          and it needs no space.
        </p>
      </header>

      {ruled.map((divergence) => (
        <div
          key={divergence.id}
          data-testid={`ruled-${divergence.path}`}
          className="flex flex-wrap items-baseline gap-5 rounded-5 border border-state-settled-border bg-state-settled-surface px-8 py-5"
        >
          <span className="text-xs font-semibold text-state-settled-ink">✓ ruled</span>
          <span className="font-mono text-xs text-ink-primary">{divergence.path}</span>
          <span className="flex-1 font-mono text-xs text-ink-secondary">
            → {divergence.ruling_value} · {divergence.citation}
            {divergence.general_rule_id === null ? " · field ruling" : ""}
          </span>
          {divergence.general_rule_id === null ? null : (
            <Chip tone="attend" size="micro" bordered>
              RULEBOOK DRAFT — PENDING
            </Chip>
          )}
        </div>
      ))}

      {open.length > 0 ? (
        <Eyebrow variant="section">{open.length} divergences open</Eyebrow>
      ) : null}

      {rule.error instanceof ApiError ? (
        <p role="alert" className="text-xs font-semibold text-state-halt-ink">
          server: {rule.error.message}
        </p>
      ) : null}

      {open.map((divergence) => (
        <DivergenceCard
          key={divergence.id}
          divergence={divergence}
          pending={rule.isPending}
          onRule={(body) => rule.mutate(body)}
        />
      ))}
    </div>
  );
}
