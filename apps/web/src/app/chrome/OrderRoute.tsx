import { ExtractionView } from "../../features/extraction/ExtractionView";
import { OrderHubScreen } from "../../features/hub/OrderHubScreen";

/**
 * The order-scoped door — two screens' worth of design on one route, since
 * the door table has no separate path for extraction. The hub's own CTA is
 * the door to the workstation at `/orders/{id}/review`.
 */
export function OrderRoute(props: { readonly orderId: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <OrderHubScreen orderId={props.orderId} />
      <ExtractionView orderId={props.orderId} />
    </div>
  );
}
