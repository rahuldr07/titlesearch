import { ExtractionView } from "../../features/extraction/ExtractionView";
import { OrderHubScreen } from "../../features/hub/OrderHubScreen";
import { Unbuilt } from "./Unbuilt";
import { REVIEW_SCREEN } from "./orderScreens";

/**

 * The order-scoped door, which is three screens' worth of design and one route.

 * `authz.ts:66` grants `/orders` as a route PREFIX, and the frozen door table has no

 * path for extraction — `ANALYSIS-screens.md` §1 row 6 places screen 6 at…

 */
export function OrderRoute(props: { readonly orderId: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <OrderHubScreen orderId={props.orderId} />
      <ExtractionView orderId={props.orderId} />
      <Unbuilt
        screen={REVIEW_SCREEN.screen}
        door={REVIEW_SCREEN.path}
        binds={REVIEW_SCREEN.binds}
        missing={REVIEW_SCREEN.missing}
      />
    </div>
  );
}
