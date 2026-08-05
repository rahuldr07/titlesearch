import type { LifecycleOrder } from "@titlepipe/contract";
import { OrderMiniCard } from "../../entities/order/OrderMiniCard";
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
 * relocates the card and never reclassifies it, and NO COUNT ON THIS SCREEN
 * MOVES WITH IT. That is what "counted separately from the stages above" states
 * and why the export's sentence is restored word for word: "shown apart from"
 * described the layout, which is the weaker claim and not the one the component
 * enforces.
 *
 * This is the one halt-coloured block on the screen. The stages are violet
 * because being stopped on a person is the design; this is red because being
 * off the pipeline is not.
 *
 * `tone="halt"` and NOTHING ELSE. The 4px left stroke is the SEVERITY mark
 * (`--stroke-severity`) that GateBanner and the failure banners wear; the
 * export draws this block as a plain 1px red-edged box, and the tint plus the
 * edge already carry it. Wearing severity here made a routine, expected state —
 * two failed orders in a shop of thirteen — compete for alarm with the screens
 * that genuinely stop the work.
 *
 * No control on it. Requeueing a failed order is a real decision with a real
 * reason attached, and a button here would invite it to be made from a summary.
 */
export function FailedBanner({ orders }: { orders: readonly LifecycleOrder[] }) {
  if (orders.length === 0) return null;

  return (
    <Card tone="halt">
      <div className="px-7 py-6">
        <Eyebrow variant="caption" tone="halt" as="h2">
          Off the pipeline — no stage to sit in
        </Eyebrow>
        <p className="mt-2 max-w-4xl text-xs leading-body text-ink-secondary">
          A failed order is not late, it is out. It needs a person to put it
          back, and it will sit here until someone does — which is why it is
          counted separately from the stages above rather than hidden inside
          one.
        </p>
        <ul className="mt-5 flex flex-wrap gap-4">
          {orders.map((order) => (
            /* The 216px floor is the export's, and it is the LIST's business
               rather than the card's: a mini-card sized by its container is the
               same component on a board column and in a wrapping row. */
            <li key={order.order_ref} className="min-w-108 shrink basis-auto">
              <OrderMiniCard
                tone="halt"
                ref={order.order_ref}
                state={order.state_label ?? undefined}
                place={`${order.addr} · ${order.county}`}
                waited={order.waited}
                waitingOn={order.waiting_on}
              />
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
