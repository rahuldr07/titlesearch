import type { LifecycleOrder } from "@titlepipe/contract";
import { Card } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * Failed orders, held OUTSIDE the board on purpose.
 *
 * A failed order has no business sitting in a column. Left there it looks like
 * work in progress and ages quietly inside a count everyone reads as "normal
 * waiting" — which is exactly how an order goes missing for a week. Out here it
 * is visibly not progressing, and the copy states the consequence: it will sit
 * until a person puts it back.
 *
 * The flag is the SERVER'S — `failed` arrives on the order. This banner
 * relocates the card and never reclassifies it, and no count on this screen
 * moves with it.
 *
 * This is the one halt-coloured block on the screen. The stages are violet
 * because being stopped on a person is the design; this is red because being
 * off the pipeline is not.
 *
 * `tone="halt"` and the left stroke are DIFFERENT CLAIMS, which is why only the
 * first moves onto the primitive. The tone is the ground-and-hairline pair the
 * export hand-spells 84 times at three different strengths; taking it from
 * `Card` is what stops this banner drifting from the other halt blocks. The 4px
 * LEFT edge is the severity mark (`--stroke-severity`) that this banner shares
 * with GateBanner and the failure banners, and it stays spelled here — `accent`
 * is a 2px TOP stripe meaning "this is the live block", which is not what a
 * failed order is.
 *
 * No control on it. Requeueing a failed order is a real decision with a real
 * reason attached, and a button here would invite it to be made from a summary.
 */
export function FailedBanner({ orders }: { orders: readonly LifecycleOrder[] }) {
  if (orders.length === 0) return null;

  return (
    <Card tone="halt" className="border-l-(length:--stroke-severity) border-l-state-halt">
      <div className="px-7 py-6">
        <Eyebrow variant="caption" tone="halt" as="h2">
          Off the pipeline — no stage to sit in
        </Eyebrow>
        <p className="mt-2 max-w-4xl text-xs leading-body text-ink-secondary">
          A failed order is not late, it is out. It needs a person to put it
          back, and it will sit here until someone does — which is why it is
          shown apart from the stages above rather than hidden inside one.
        </p>
        <ul className="mt-5 flex flex-wrap gap-4">
          {orders.map((order) => (
            <li
              key={order.order_ref}
              className="min-w-108 shrink basis-auto rounded-7 border border-state-halt-border bg-surface-panel px-5 py-4"
            >
              <span className="font-mono text-xs font-semibold text-ink-primary">
                {order.order_ref}
              </span>
              <p className="mt-2 text-tiny leading-close text-ink-muted">
                {order.addr} · {order.county}
              </p>
              <div className="mt-3 border-t border-line-subtle pt-3">
                {order.waited === null ? null : (
                  <p className="font-mono text-tiny text-ink-secondary">{order.waited}</p>
                )}
                <p className="mt-1 text-tiny leading-close text-state-halt-ink">
                  {order.waiting_on ?? "Needs a person to put it back"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
