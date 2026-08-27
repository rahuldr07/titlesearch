import { useState } from "react";
import type { DeliveryWithReport } from "@titlepipe/contract";
import { Card, CardBody, CardHeader, Empty, Skeleton, cx } from "../../components/ui";
import { useDeliveries } from "./useDeliveries";
import { CertifiedDeliverables } from "./CertifiedDeliverables";
import { TransmissionReceipt } from "./TransmissionReceipt";
import { VersionLedger } from "./VersionLedger";

/**
 * SCREEN 9 — DELIVERED, at `/delivery` (authz.ts:70, `ops`/`admin`).
 *
 * ══ THE SCREEN IS ORDER-SCOPED AND THE ENDPOINT IS NOT ═════════════════════
 *
 * The design draws ONE delivered order: its header, its deliverables, its
 * receipt, its ledger. `GET /api/deliveries` returns every delivery across
 * every order, and there is no per-order delivery endpoint. So the left column
 * is the orders that have a delivery, grouped from the one response, and
 * everything to the right is scoped to the selected one.
 *
 * The grouping is by `report.order_id` — the server's own field — and is not a
 * derivation of state: it is the same rows, arranged. `endpoints.ts:615-616`
 * anticipates it ("both v1 and v2 rows appear — the pair is the defect
 * record"), which is only readable AS a pair once the two are adjacent.
 *
 * ══ NO REISSUE, NO SHA, NO NAMED RECEIPT STEPS ═════════════════════════════
 *
 * Three refusals, each stated where the design put the thing. See
 * `VersionLedger` (reissue), `CertifiedDeliverables` (SHA and View) and
 * `TransmissionReceipt` (the four steps, blocked on `DeliveryStatus` being
 * `z.string()` and explicitly OPEN).
 */
export function DeliveryScreen() {
  const deliveries = useDeliveries();
  const [selected, setSelected] = useState<string | null>(null);

  const orders = groupByOrder(deliveries.data?.deliveries ?? []);
  const current = orders.find(([id]) => id === selected) ?? orders[0] ?? null;

  return (
    <div data-testid="delivery-screen" className="flex h-full min-h-0 flex-col gap-12 overflow-y-auto p-14">
      <header className="flex flex-col gap-3">
        <h1 className="font-sans text-title leading-tight font-bold text-ink-primary">
          Delivered
        </h1>
        <p className="font-sans text-meta leading-body text-ink-secondary">
          What left the building, and the record of it leaving.
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
        <div className="grid grid-cols-[minmax(0,300px)_minmax(0,1fr)] gap-12">
          <Card padding="none">
            <CardHeader>Delivered orders</CardHeader>
            <CardBody className="flex flex-col p-0">
              {orders.map(([orderId, rows]) => (
                <button
                  key={orderId}
                  type="button"
                  data-testid={`delivered-order-${orderId}`}
                  aria-current={current !== null && current[0] === orderId}
                  onClick={() => setSelected(orderId)}
                  className={cx(
                    "tp-state flex cursor-pointer flex-col gap-2 border-b border-line-subtle px-10 py-8 text-left",
                    "last:border-b-0 hover:bg-surface-sunken",
                    current !== null && current[0] === orderId && "bg-surface-sunken",
                  )}
                >
                  <span className="font-mono text-meta leading-close text-ink-primary">
                    {orderId}
                  </span>
                  <span className="font-sans text-label leading-flat text-ink-faint">
                    {rows.length === 1 ? "one version" : `${String(rows.length)} versions`}
                  </span>
                </button>
              ))}
            </CardBody>
          </Card>

          {current !== null && (
            <div className="flex flex-col gap-12">
              <CertifiedDeliverables deliveries={current[1]} />
              {current[1].map((delivery) => (
                <TransmissionReceipt key={delivery.id} delivery={delivery} />
              ))}
              <VersionLedger versions={current[1]} />
            </div>
          )}
        </div>
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
