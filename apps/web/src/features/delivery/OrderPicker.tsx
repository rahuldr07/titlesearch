import type { DeliveryWithReport } from "@titlepipe/contract";
import { cx } from "../../components/ui";

/**
 * Chooses which delivered order the grid shows — `GET /api/deliveries` is not
 * order-scoped and there is no per-order endpoint. `aria-current` rather than
 * `aria-selected`: these are not tabs and own no panels — they re-scope the grid.
 *
 * The button prints the REF (`4176034-1`), not the internal id. It printed
 * `ord_demo_12` until `Report.order_ref` was added to the wire — the join a
 * screen may not invent, now carried. An order whose report the server cannot
 * name falls back to the id rather than printing nothing: an unnamed record
 * is still a record.
 */
export function OrderPicker({
  orders,
  current,
  onSelect,
}: {
  readonly orders: readonly (readonly [string, readonly DeliveryWithReport[]])[];
  readonly current: string | null;
  readonly onSelect: (orderId: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-6">
      <span className="font-sans text-label leading-flat font-bold text-ink-muted">
        Delivered orders
      </span>
      <div className="flex flex-wrap gap-1 rounded-md border border-line-strong bg-surface-sunken p-2">
        {orders.map(([orderId, rows]) => {
          const active = orderId === current;
          return (
            <button
              key={orderId}
              type="button"
              data-testid={`delivered-order-${orderId}`}
              aria-current={active}
              onClick={() => {
                onSelect(orderId);
              }}
              className={cx(
                "tp-state tp-press tp-target tp-ring flex cursor-pointer items-baseline gap-4 rounded-sm px-6",
                active
                  ? "bg-surface-panel font-semibold text-ink-primary shadow-card"
                  : "font-medium text-ink-muted hover:text-ink-primary",
              )}
            >
              <span className="font-mono text-meta leading-close">
                {rows.find((r) => r.report?.order_ref != null)?.report?.order_ref ?? orderId}
              </span>
              <span className="font-sans text-label leading-flat">
                {rows.length === 1 ? "one version" : `${String(rows.length)} versions`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
