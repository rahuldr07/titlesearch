import { OrderHubScreen } from "../../features/hub/OrderHubScreen";

/**
 * The order-scoped door: the HUB, and only the hub.
 *
 * It used to render the extraction telemetry underneath as well — two
 * screens' worth of design stacked on one route, on the reasoning that the
 * door table had no path for extraction. It has one: authz grants `/orders`
 * as a PREFIX, which is what `/orders/{id}/review` and `/orders/{id}/release`
 * already stand on, so `/orders/{id}/extraction` invents no door either. The
 * cost of the stack was a 3414px page that printed the pipeline's nine stages
 * twice and left the two blocks on different surfaces.
 */
export function OrderRoute(props: { readonly orderId: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <OrderHubScreen orderId={props.orderId} />
    </div>
  );
}
