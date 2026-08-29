import type { Order } from "@titlepipe/contract";
import { Button, Card } from "../../components/ui";
import { OrderRef } from "../../entities/order/OrderRef";
import { SpotlightMeta } from "./SpotlightMeta";
import { RouteButton } from "../../app/chrome/RouteButton";
import { useOverlays } from "../../app/keyboard/overlays";

/**
 * The served order in the prototype's spotlight card.
 *
 * Three of the prototype's values have no member on `Order` (`entities.ts:32`)
 * and are not invented: the SLA chip, the "Assigned:" line, and the street
 * address it puts ahead of the county. `county` and `state` DO ride on the
 * shape, so the place line is those two rather than the `jurisdiction` slug,
 * which is a routing key and not a name a person reads.
 */
export function SpotlightOrder(props: { readonly order: Order }) {
  const order = props.order;
  const openHistory = useOverlays((s) => s.openOrderHistory);

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

        {/* "Audit history" is the MODAL, not a navigation — the reference's
            history affordance opens the overlay everywhere it appears, and
            `openOrderHistory` names the order so it works off any route.
            `RouteButton` for the navigation, not `LinkButton`: `to`/`params`
            are checked against the route tree; react-aria's `href` is an
            unchecked string. */}
        <div className="flex shrink-0 items-center gap-6">
          <Button
            variant="secondary"
            onPress={() => openHistory(order.id)}
            data-testid="spotlight-history"
          >
            Audit history
          </Button>
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
