import { Link } from "@tanstack/react-router";
import type { LifecycleOrder } from "@titlepipe/contract";
import { InnerPanel } from "../../components/ui";
import { OrderRef } from "../../entities/order/OrderRef";

/**

 * One order on the board, and it is a link. `LifecycleOrder.id` (`intake.ts:188-206`)

 * exists for exactly this: "`id` is the join the census never had.

 */
export function OrderCard(props: { readonly order: LifecycleOrder }) {
  const order = props.order;

  return (
    <li>
      <Link
        to="/orders/$orderId"
        params={{ orderId: order.id }}
        data-order-card={order.id}
        className="tp-state block rounded-md"
      >
        {/*
         * The 10px rung inside the column's 14px card (rule 5: inner = outer −
         * gap). `InnerPanel` rather than a hand-rolled div because nested Cards
         * are forbidden and this is the barrel's answer to that shape; the
         * `Link` wraps it rather than the reverse so the whole panel is the hit
         * target and one focus ring surrounds it.
         */}
        <InnerPanel
          padding="none"
          className="flex flex-col gap-2 px-6 py-5 hover:bg-row-hover"
        >
          {/* Rule 3's first named example: an order ref is data, so it is mono. */}
          <OrderRef orderRef={order.order_ref} emphasis="subject" />

          <span className="font-sans text-meta leading-close text-ink-secondary">
            {order.addr}
          </span>

          <span className="font-sans text-label leading-flat text-ink-muted">
            {order.county}
          </span>

          {order.state_label !== null && (
            <span
              data-state-label={order.state_label}
              className="font-sans text-label leading-flat font-semibold text-ink-secondary"
            >
              {order.state_label}
            </span>
          )}

          {order.mine && (
            <span className="font-sans text-label leading-flat text-ink-muted">
              Yours
            </span>
          )}
        </InnerPanel>
      </Link>
    </li>
  );
}
