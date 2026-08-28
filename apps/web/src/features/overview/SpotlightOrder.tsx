import type { Order } from "@titlepipe/contract";
import { Card } from "../../components/ui";
import { OrderRef } from "../../entities/order/OrderRef";
import { SpotlightMeta } from "./SpotlightMeta";
import { RouteButton } from "../../app/chrome/RouteButton";

/**
 * The served order in the prototype's spotlight card: 4px accent rail, 24px
 * padding, solid accent pill, then ref · place, then the meta row.
 *
 * Three of the prototype's values have no member on `Order` (`entities.ts:32`)
 * and are not invented: the SLA chip, the "Assigned:" line, and the street
 * address the prototype puts ahead of the county. `county` and `state` DO ride
 * on the shape, so the place line is those two rather than the `jurisdiction`
 * slug, which is a routing key and not a name a person reads.
 */
export function SpotlightOrder(props: { readonly order: Order }) {
  const order = props.order;

  return (
    <Card className="border-l-4 border-l-action">
      <div className="flex flex-wrap items-center justify-between gap-12">
        <div className="flex min-w-0 flex-col gap-6">
          <span className="w-fit rounded-pill bg-action px-5 py-1 text-label font-bold leading-flat text-ink-on-action">
            Active spotlight
          </span>

          <div className="flex flex-wrap items-baseline gap-7">
            <OrderRef orderRef={order.external_ref} emphasis="spotlight" />
            <span className="text-subject font-semibold leading-tight text-ink-primary">
              {order.county}, {order.state}
            </span>
          </div>

          <SpotlightMeta order={order} />
        </div>

        {/* `RouteButton`, not `LinkButton`: `to`/`params` are checked against
            the route tree; react-aria's `href` is an unchecked string. */}
        <div className="flex shrink-0 items-center gap-6">
          <RouteButton
            variant="secondary"
            to="/orders/$orderId"
            params={{ orderId: order.id }}
            data-testid="spotlight-history"
          >
            Audit history
          </RouteButton>
          <RouteButton
            variant="primary"
            to="/orders/$orderId/review"
            params={{ orderId: order.id }}
            data-testid="spotlight-open"
          >
            Open review
          </RouteButton>
        </div>
      </div>
    </Card>
  );
}
