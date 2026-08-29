import { useState } from "react";
import type { DeliveryWithReport } from "@titlepipe/contract";
import { Empty, Skeleton } from "../../components/ui";
import { useDeliveries } from "./useDeliveries";
import { CertifiedDeliverables } from "./CertifiedDeliverables";
import { ReceiptGap, TransmissionReceipt } from "./TransmissionReceipt";
import { VersionLedger } from "./VersionLedger";
import { ReissueGateway } from "./ReissueGateway";
import { OrderPicker } from "./OrderPicker";

/**
 * SCREEN 9 — DELIVERED, at `/delivery` (authz.ts:70, `ops`/`admin`).
 *
 * ══ THE PROTOTYPE'S SHELL, MEASURED ════════════════════════════════════════
 *
 * `reference-app.html`'s `isDelivered` block:
 *
 *     page padding 32px 32px 64px on the app canvas
 *     header: kicker pill, h1 28px w700, note 16px max-width 640px
 *             (the SHA-256 chip is per artifact, see CertifiedDeliverables)
 *     grid minmax(0,1fr) / 340px, gap 24px, align-start
 *       left  column: Certified deliverables, Transmission receipt
 *       right column: Version ledger, Reissue gateway (refused)
 *
 * ══ THE SCREEN IS ORDER-SCOPED AND THE ENDPOINT IS NOT ═════════════════════
 *
 * The design draws ONE delivered order. `GET /api/deliveries` returns every
 * delivery across every order, and there is no per-order delivery endpoint. So
 * the orders that have a delivery become a picker under the header — the
 * design's own tab-track shape, borrowed from its escalations pane — and
 * everything in the grid is scoped to the selected one. It sits BELOW the
 * header rather than in a left rail so the grid keeps the full width the
 * prototype gives it.
 *
 * The grouping is by `report.order_id` — the server's own field — and is not a
 * derivation of state: it is the same rows, arranged. `endpoints.ts:615-616`
 * anticipates it ("both v1 and v2 rows appear — the pair is the defect
 * record"), which is only readable AS a pair once the two are adjacent.
 *
 * ══ ONE REFUSAL LEFT ═══════════════════════════════════════════════════════
 *
 * The reissue gateway and the deliverable digests are built — both have wire
 * surface now. `TransmissionReceipt` still refuses the design's four named
 * steps, blocked on `DeliveryStatus` being `z.string()` and explicitly OPEN.
 */
export function DeliveryScreen() {
  const deliveries = useDeliveries();
  const [selected, setSelected] = useState<string | null>(null);

  const orders = groupByOrder(deliveries.data?.deliveries ?? []);
  const current = orders.find(([id]) => id === selected) ?? orders[0] ?? null;

  return (
    <div
      data-testid="delivery-screen"
      className="tp-screen-enter flex h-full min-h-0 flex-col gap-16 overflow-y-auto px-16 pt-16 pb-32"
    >
      <header className="flex min-w-0 flex-col gap-3">
        {/*
         * The prototype's kicker pill is a green capsule. It is a plain label
         * here: rule 6 spends a tinted capsule on a moment of record, and the
         * ledger rows below are that. A green pill over a screen that also
         * carries a bounced delivery would be colour making a claim the rows
         * contradict.
         */}
        <span className="font-sans text-label leading-flat font-semibold text-ink-muted">
          Delivery gateway · read-only record
        </span>
        <h1 className="font-sans text-title leading-tight font-bold text-ink-primary">
          Delivered
        </h1>
        <p className="max-w-320 font-sans text-body leading-body text-ink-secondary">
          What left the building, and the record of it leaving. Both versions of
          a reissued order stay on the record — the pair is the defect record.
        </p>
      </header>

      {deliveries.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : orders.length === 0 ? (
        <Empty
          title="Nothing delivered"
          reason="No report has been transmitted yet. A delivery appears here once a released report is sent."
        />
      ) : (
        <>
          <OrderPicker
            orders={orders}
            current={current === null ? null : current[0]}
            onSelect={setSelected}
          />

          {current !== null && (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,340px)] items-start gap-12">
              <div className="flex min-w-0 flex-col gap-12">
                <CertifiedDeliverables deliveries={current[1]} />
                {current[1].map((delivery) => (
                  <TransmissionReceipt key={delivery.id} delivery={delivery} />
                ))}
                <ReceiptGap />
              </div>
              <div className="flex min-w-0 flex-col gap-12">
                <VersionLedger versions={current[1]} />
                <ReissueGateway deliveries={current[1]} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The response's rows, arranged by the order their embedded report names.
 * Insertion-ordered, so the server's sequence survives; a delivery with no
 * report is keyed on its own id rather than dropped, because a delivery the UI
 * cannot place is a fact about the data worth seeing.
 */
function groupByOrder(
  rows: readonly DeliveryWithReport[],
): readonly (readonly [string, readonly DeliveryWithReport[]])[] {
  const byOrder = new Map<string, DeliveryWithReport[]>();
  for (const row of rows) {
    const key = row.report?.order_id ?? row.id;
    const bucket = byOrder.get(key);
    if (bucket === undefined) byOrder.set(key, [row]);
    else bucket.push(row);
  }
  return [...byOrder.entries()];
}
