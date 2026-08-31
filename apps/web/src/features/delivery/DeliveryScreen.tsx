import { useState } from "react";
import type { DeliveryWithReport } from "@titlepipe/contract";
import { Empty, Skeleton } from "../../components/ui";
import { useDeliveries } from "./useDeliveries";
import { CertifiedDeliverables } from "./CertifiedDeliverables";
import { TransmissionReceipt } from "./TransmissionReceipt";
import { VersionLedger } from "./VersionLedger";
import { ReissueGateway } from "./ReissueGateway";
import { OrderPicker } from "./OrderPicker";

/**
 * Delivered screen at `/delivery` (`ops`/`admin`). The screen shows one
 * delivered order, but `GET /api/deliveries` returns every delivery and there
 * is no per-order endpoint — so a picker under the header scopes the grid.
 * Grouping is by `report.order_id`, the server's own field; both versions of a
 * reissued order stay visible — the pair is the defect record.
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
 * Insertion-ordered, so the server's sequence survives. A delivery with no
 * report is keyed on its own id rather than dropped.
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
