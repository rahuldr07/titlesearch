import { useQuery } from "@tanstack/react-query";
import { OrderContextResponse, type Order } from "@titlepipe/contract";
import { get } from "../../shared/api";
import { Button, Card } from "../../components/ui";
import { OrderRef } from "../../entities/order/OrderRef";
import { SpotlightMeta } from "./SpotlightMeta";
import { RouteButton } from "../../app/chrome/RouteButton";
import { useOverlays } from "../../app/keyboard/overlays";

/**
 * The served order in the spotlight card. The due chip and the "Assigned:"
 * line ride the order-scoped context, not `Order` — the due label arrives
 * whole (no clock runs in this browser) and `assigned` is the server's word
 * for who holds the work.
 */
export function SpotlightOrder(props: { readonly order: Order }) {
  const order = props.order;
  const openHistory = useOverlays((s) => s.openOrderHistory);
  const context = useQuery({
    queryKey: ["orders", order.id, "context"],
    queryFn: () => get(`/api/orders/${order.id}/context`, OrderContextResponse),
  });

  return (
    <Card className="border-l-4 border-l-action">
      <div className="flex flex-wrap items-center justify-between gap-12">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-wrap items-center gap-5">
            <span className="w-fit rounded-pill bg-action px-5 py-1 text-label font-bold leading-flat text-ink-on-action">
              Active Spotlight
            </span>
            {context.data?.due != null && (
              <span
                data-testid="spotlight-due"
                className="rounded-pill bg-state-settled-surface px-5 py-1 font-mono text-meta font-semibold leading-flat text-state-settled"
              >
                {context.data.due}
              </span>
            )}
            {context.data?.assigned != null && (
              <span
                data-testid="spotlight-assigned"
                className="font-mono text-label leading-flat text-ink-faint"
              >
                Assigned: {context.data.assigned}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-baseline gap-7">
            <OrderRef orderRef={order.external_ref} emphasis="spotlight" />
            <span className="text-subject font-semibold leading-tight text-ink-primary">
              {order.county}, {order.state}
            </span>
          </div>

          <SpotlightMeta order={order} />
        </div>

        {/* "Audit history" is the modal, not a navigation —
            `openOrderHistory` names the order so it works off any route.
            `RouteButton` for the navigation: `to`/`params` are checked
            against the route tree, while `LinkButton`'s `href` is an
            unchecked string. */}
        <div className="flex shrink-0 items-center gap-6">
          <Button
            variant="secondary"
            onPress={() => openHistory(order.id)}
            data-testid="spotlight-history"
          >
            Audit History
          </Button>
          <RouteButton
            variant="primary"
            to="/orders/$orderId/review"
            params={{ orderId: order.id }}
            data-testid="spotlight-open"
          >
            Launch Workstation →
          </RouteButton>
        </div>
      </div>
    </Card>
  );
}
