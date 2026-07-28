import type { LifecycleOrder } from "@titlepipe/contract";

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
 * Where the server sends nothing, the row stays silent rather than printing a
 * zero the screen would have had to invent.
 *
 * CONTRACT GAP: the census does not say whether an order is the viewer's own,
 * so the design's violet edge and "yours" stamp are absent. It also carries no
 * order id, only a reference, so the card is not a link. When either lands the
 * card becomes the button the design draws.
 */
export function OrderCard({ order }: { order: LifecycleOrder }) {
  return (
    <div className="rounded-7 border border-line-strong bg-surface-panel p-4">
      <span className="font-mono text-xs font-semibold text-ink-primary">{order.order_ref}</span>
      <p className="mt-2 text-tiny leading-close text-ink-muted">
        {order.addr} · {order.county}
      </p>
      {order.waited === null && order.waiting_on === null ? null : (
        <div className="mt-3 border-t border-line-subtle pt-3">
          {order.waited === null ? null : (
            <p className="font-mono text-tiny text-ink-secondary">{order.waited}</p>
          )}
          {order.waiting_on === null ? null : (
            <p className="mt-1 text-tiny leading-close text-ink-muted">{order.waiting_on}</p>
          )}
        </div>
      )}
    </div>
  );
}
