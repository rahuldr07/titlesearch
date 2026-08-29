import type { DeliveryWithReport } from "@titlepipe/contract";
import { cx } from "../../components/ui";

/**
 * THE ONE THING ON THIS SCREEN THE PROTOTYPE DOES NOT DRAW.
 *
 * The design's delivered screen is scoped to a single order. `GET
 * /api/deliveries` is not, and there is no per-order delivery endpoint, so
 * something has to choose which order the grid is showing.
 *
 * It takes the shape the prototype uses for its own single-select strips — a
 * sunken 10px track, 4px of padding, 6px cells, the selected cell raised in
 * white with no accent (rule 1: a selector is not the screen's decision, and
 * rule 5: 6 = 10 − 4, the padding IS the gap). Laid out horizontally under the
 * header rather than as a left rail, so the two-column grid below keeps the
 * full width the prototype gives it.
 *
 * `aria-current` rather than `aria-selected`: these are not tabs and own no
 * panel each — they re-scope the whole grid.
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
              <span className="font-mono text-meta leading-close">{orderId}</span>
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
