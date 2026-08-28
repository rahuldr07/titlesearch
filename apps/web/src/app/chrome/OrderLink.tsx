import { Link } from "@tanstack/react-router";
import { cx } from "../../components/ui";

/**
 * AN ORDER ID, AS A DOOR. One spelling of "link to this order", because six
 * screens hold an order id and every one of them was printing it as inert text.
 *
 * `Complaint.order_id`, `GoldenField.order_id`, `Reconciliation.order_id`,
 * `Escalation.order_ids`, `LifecycleOrder.id` and `Delivery`'s report all name
 * an order the reader will want to open, and until now only the lifecycle board
 * actually linked. A defect that names an order you cannot reach is a dead end
 * — which is the exact phrase `intake.ts:192-196` uses for why `LifecycleOrder`
 * gained its `id` at all: "A card that names work nobody can reach is a dead
 * end."
 *
 * ══ WHY IT IS IN `app/` AND NOT `entities/` ════════════════════════════════
 *
 * `entities/order/OrderRef` is the right home by subject and the wrong one by
 * layer: `check-rules`' `presentational-fetches` bans `@tanstack/react-router`
 * from `shared/` and `entities/` outright, so nothing down there can hold a
 * `Link`. `app/` is the layer that knows the route tree and that every feature
 * may import — the same argument `useRead.ts` and `RouteButton.tsx` make.
 *
 * ══ TYPED, WHICH THE ALTERNATIVE IS NOT ════════════════════════════════════
 *
 * `to`/`params` are checked against `routeTree.tsx`, so a renamed route or a
 * missing param is a compile error. The seven `LinkButton href={`/orders/${id}`}`
 * spellings that predate this are plain strings and are checked by nothing.
 *
 * ══ IT DOES NOT RESTATE `OrderRef`'S TYPOGRAPHY ════════════════════════════
 *
 * Rule 3 says an order reference is data, so it is mono, and `OrderRef` owns
 * what that looks like at three emphases. This component is the DOOR, not the
 * ref: it carries the link affordance and the focus ring, and takes whatever it
 * is given as its child. A screen that wants the styled ref passes `OrderRef`;
 * one that has only an opaque id passes the id.
 */
export function OrderLink(props: {
  readonly orderId: string;
  readonly className?: string | undefined;
  readonly children: React.ReactNode;
}) {
  return (
    <Link
      to="/orders/$orderId"
      params={{ orderId: props.orderId }}
      data-testid="order-link"
      className={cx(
        "tp-state rounded-sm underline-offset-4 hover:underline",
        props.className,
      )}
    >
      {props.children}
    </Link>
  );
}
