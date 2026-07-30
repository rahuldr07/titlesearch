import type { LifecycleOrder } from "@titlepipe/contract";
import { Card } from "../../shared/ui/Card";

/**
 * One order, as it appears inside a stage column.
 *
 * `size="nested"` is the 8px radius the design gives a card INSIDE a card, and
 * the reason to take it from `Card` rather than respell it is that the two greys
 * are respelled with it: this drew `border-line-strong` on `surface-panel` by
 * hand, which is the right pair, but nothing here was holding it to that. A card
 * banded with the inner `line-subtle` reads as one row of a table, and seven
 * columns of table rows is a different board.
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
 * BOTH GAPS ARE CLOSED ON THE WIRE (2026-07-30, Wave 2) AND NEITHER IS DRAWN
 * HERE YET. `LifecycleOrder` now carries `id`, `mine` and `state_label`, so the
 * design's violet edge, its "yours" mark and the card-as-link are all
 * expressible — and none of them is a text render: they are the board's
 * appearance, which Wave 4 rebuilds. This note stays as the record of what is
 * available rather than as a claim that it is missing, because a stale gap note
 * is how a field lands and nothing ever reads it.
 */
export function OrderCard({ order }: { order: LifecycleOrder }) {
  return (
    <Card size="nested" className="p-4">
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
    </Card>
  );
}
