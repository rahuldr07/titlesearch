import { Link } from "@tanstack/react-router";
import type { LifecycleOrder, LifecycleResponse } from "@titlepipe/contract";
import { OrderRef } from "../../entities/order/OrderRef";

/**

 * FAILED ORDERS, LIFTED TO THE TOP — because there is no failed COLUMN.

 * `packages/mocks/src/workspace.ts:358-367` records the decision and the reason it is

 * a decision rather than an omission: "a `failed` column could not hold a card at…

 */
export function FailedBanner(props: { readonly board: LifecycleResponse }) {
  if (props.board.failed === 0) return null;

  const failed: LifecycleOrder[] = props.board.stages.flatMap((stage) =>
    stage.orders.filter((order) => order.failed),
  );

  return (
    <section
      data-testid="failed-banner"
      aria-labelledby="failed-banner-title"
      className="flex flex-col gap-5 rounded-lg border border-state-halt-border bg-state-halt-surface px-12 py-10"
    >
      <div className="flex items-baseline gap-6">
        <h2
          id="failed-banner-title"
          className="font-sans text-meta leading-close font-bold text-state-halt"
        >
          Failed
        </h2>
        <span
          data-failed-count={props.board.failed}
          className="font-sans text-subject leading-flat font-bold tabular-nums text-state-halt"
        >
          {props.board.failed}
        </span>
      </div>

      <p className="max-w-320 font-sans text-meta leading-body text-ink-secondary">
        The board has no failed column. A failed order stays in the stage it stopped in,
        and is named here as well. The count is the server&rsquo;s across the whole
        shop; the links below are the ones you may open.
      </p>

      {failed.length > 0 && (
        <ul className="flex flex-wrap gap-4">
          {failed.map((order) => (
            <li key={order.id}>
              <Link
                to="/orders/$orderId"
                params={{ orderId: order.id }}
                data-failed-order={order.id}
                className="tp-state flex items-baseline gap-4 rounded-md border border-state-halt-border bg-surface-panel px-6 py-4 hover:bg-row-hover"
              >
                <OrderRef orderRef={order.order_ref} />
                {order.state_label !== null && (
                  <span className="font-sans text-label leading-flat font-semibold text-state-halt">
                    {order.state_label}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
