import { Chip } from "../../shared/ui/Chip";
import { cn } from "../../shared/ui/classNames";
import type { LifecycleOrder } from "./lifecycle";

/**
 * One order, as it appears inside a stage column.
 *
 * FOUR FACTS AND NO MORE: which order, where, how long it has sat, and what it
 * is stopped on. The last one is the card's whole reason to exist — a board
 * that showed only "how long" would be a lateness display, and lateness is not
 * actionable. "Sign-off open" tells a person what to go and do.
 *
 * `waited` is SERVER TEXT rendered verbatim. There is no clock in this
 * component and nothing here counts up: an elapsed timer on a work item is a
 * pace indicator wearing a helpful hat, and this product does not pace people.
 *
 * The violet edge plus the "yours" stamp is the only emphasis available, and it
 * means exactly one thing — this one is waiting on the person reading it.
 *
 * CONTRACT GAP: no lifecycle endpoint means no real order ids, so the card is
 * not a link. When one lands it becomes the button the design draws.
 */
export function OrderCard({ order }: { order: LifecycleOrder }) {
  return (
    <div
      className={cn(
        "rounded-7 border bg-surface-panel p-4",
        order.yours
          ? "border-(length:--stroke-emphasis) border-action"
          : "border-line-strong",
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-xs font-semibold text-ink-primary">{order.order}</span>
        {order.yours ? <Chip tone="inverse" size="micro">yours</Chip> : null}
      </div>
      <p className="mt-2 text-tiny leading-close text-ink-muted">{order.addr}</p>
      <div className="mt-3 border-t border-line-subtle pt-3">
        <p className="font-mono text-tiny text-ink-secondary">{order.waited}</p>
        <p className="mt-1 text-tiny leading-close text-ink-muted">{order.waitOn}</p>
      </div>
    </div>
  );
}
