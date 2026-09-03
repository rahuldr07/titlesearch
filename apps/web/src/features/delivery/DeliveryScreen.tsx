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
export function DeliveryScreen({ order }: { readonly order?: string | undefined }) {
  const deliveries = useDeliveries();
  const [selected, setSelected] = useState<string | null>(null);

  const orders = groupByOrder(deliveries.data?.deliveries ?? []);
  /*
   * `?order=` is the stage strip naming the order it came from. It is the
   * FALLBACK for the picker, not an override — a reader who picks another
   * order stays where they put themselves. An order with no delivered record
   * matches nothing and the first row shows, which is the same answer as
   * arriving with no key at all.
   */
  const asked = order === undefined ? null : (orders.find(([id]) => id === order) ?? null);
  const current =
    orders.find(([id]) => id === selected) ?? asked ?? orders[0] ?? null;
  /*
   * Two screens share this route. Arriving from an order's stage strip
   * (`?order=`) it is that order's record and its own versions — "only the
   * active one and past histories". Arriving from the rail door with no
   * order it stays the ops index over everything delivered. The other
   * orders are never hidden, only demoted: a delivered record is history,
   * and history you cannot reach is not a record.
   */
  const scoped = asked !== null && selected === null;
  const others = orders.filter(([id]) => id !== (current?.[0] ?? null));

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
          {scoped ? (
            <p
              data-testid="delivery-scope"
              className="font-sans text-meta leading-body text-ink-secondary"
            >
              This order's delivered record.{" "}
              <span className="text-ink-muted">
                {current !== null && current[1].length > 1
                  ? `${String(current[1].length)} versions on the record — every one is kept.`
                  : "One version on the record."}
              </span>
            </p>
          ) : (
            <OrderPicker
              orders={orders}
              current={current === null ? null : current[0]}
              onSelect={setSelected}
            />
          )}

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

          {scoped && others.length > 0 && (
            <section
              data-testid="other-delivered"
              className="flex min-w-0 flex-col gap-6 border-t border-line-subtle pt-12"
            >
              <h2 className="font-sans text-label leading-flat font-bold text-ink-faint">
                Other delivered orders
              </h2>
              <OrderPicker
                orders={others}
                current={null}
                onSelect={setSelected}
              />
            </section>
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
