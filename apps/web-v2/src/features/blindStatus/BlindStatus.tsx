import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { metricsQuery } from "./queries";
import { CoverageList } from "./CoverageList";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { ScreenTitle } from "../../app/ScreenTitle";

/**
 * BLIND FIFTY — STATUS. Read-only: you see the state, you act elsewhere.
 *
 * DIVERGENCE IS SHOWN AT ORDER LEVEL ONLY, and the screen says so out loud.
 * Field-level disagreement between two typists stays blind until reconciliation,
 * because a typist who can see where they differ from their partner stops
 * reading and starts negotiating — and the blind pass is the entire measurement.
 *
 * NO PACE DATA OF ANY KIND. There is no rate, no elapsed count, nothing that
 * turns careful reading into a number to beat. The one honest signal is how long
 * the oldest ready order has waited, which points at the senior as the
 * bottleneck rather than at anyone typing.
 */
export function BlindStatus() {
  const { data, isPending, isError } = useQuery(metricsQuery);

  if (isError) return <p className="text-base text-state-halt-ink">Status unavailable.</p>;
  if (isPending) return <p className="text-base text-ink-secondary">Loading the fifty…</p>;

  const bf = data.blind_fifty;
  if (bf === undefined) {
    return (
      <p className="text-base text-ink-secondary">
        The server is not reporting blind-fifty state yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <ScreenTitle>Blind fifty — status</ScreenTitle>
        <p className="text-xs text-ink-muted">
          read-only — you see the state, you act elsewhere
        </p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card accent="attend">
          <CardBody className="flex flex-col gap-2">
            <Eyebrow variant="caption">Ready for reconciliation</Eyebrow>
            <span data-testid="ready-count" className="font-mono text-3xl text-ink-primary">
              {bf.ready_for_reconciliation}
            </span>
            <p className="text-tiny leading-body text-ink-muted">
              both typists done, senior has not started
              {bf.oldest_waiting_days === null
                ? ""
                : ` — oldest has waited ${bf.oldest_waiting_days} days`}
              . If this grows, the senior is the bottleneck.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-col gap-2">
            <Eyebrow variant="caption">Typist divergence — order level only</Eyebrow>
            <span className="font-mono text-lg text-ink-primary">
              A {bf.submitted_a} · B {bf.submitted_b}
            </span>
            <p className="text-tiny leading-body text-ink-muted">
              submitted · gap {Math.abs(bf.submitted_a - bf.submitted_b)} — a wide
              gap means someone has stalled; ask why in person.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-col gap-2">
            <Eyebrow variant="caption">Reconciled</Eyebrow>
            <span className="font-mono text-3xl text-ink-primary">{bf.reconciled}</span>
            <p className="text-tiny text-ink-muted">of {bf.orders_total} — the count, not a percentage</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-col gap-2">
            <Eyebrow variant="caption">Rulebook drafts pending</Eyebrow>
            <span className="font-mono text-3xl text-ink-primary">{bf.drafts_pending}</span>
            <p className="text-tiny leading-body text-ink-muted">
              above ten needs an engineer before the fifty closes
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader filled>
          <Eyebrow variant="section">Orders — sorted by reconciliation readiness</Eyebrow>
        </CardHeader>
        <CardBody className="p-0">
          <ul>
            {bf.orders.map((order) => (
              <li
                key={order.order_ref}
                className="flex flex-wrap items-baseline gap-5 border-t border-line-subtle px-8 py-4 first:border-t-0"
              >
                <span className="w-32 font-mono text-xs text-ink-primary">{order.order_ref}</span>
                <span className="w-36 text-xs text-ink-secondary">{order.jurisdiction}</span>
                <span className="w-28 text-xs text-ink-muted">A {order.a_submitted}</span>
                <span className="w-28 text-xs text-ink-muted">B {order.b_submitted}</span>
                <span className="flex-1 text-xs text-ink-secondary">
                  {order.reconciliation ?? "—"}
                </span>
                <span className="text-xs text-ink-muted">{order.golden_line ?? ""}</span>
                <span className="text-xs text-ink-muted">{order.drafts ?? ""}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <p className="max-w-3xl text-xs leading-body text-ink-muted">
        Sorted by reconciliation readiness, not order id — the actionable rows are
        already at the top. Field-level disagreements stay blind until
        reconciliation, and the machine appears nowhere on this screen.{" "}
        <Link to="/reconciliation" className="font-semibold text-action underline">
          Reconciliation
        </Link>
      </p>

      <CoverageList
        coverage={bf.section_coverage}
        judgmentTarget={bf.judgment_fields_target}
      />
    </div>
  );
}
