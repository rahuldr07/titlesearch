import { ExtractionView } from "../../features/extraction/ExtractionView";
import { OrderHubScreen } from "../../features/hub/OrderHubScreen";

/**

 * The order-scoped door, which is two screens' worth of design and one route.

 * `authz.ts:66` grants `/orders` as a route PREFIX, and the frozen door table has no

 * path for extraction — `ANALYSIS-screens.md` §1 row 6 places screen 6 at…

 *

 * No Unbuilt card any more: the Examination Workstation IS built, at

 * `/orders/{id}/review` (`orderRoutes.tsx`), with its contract surface landed

 * under RULING-2026-08-28 — `Countersign` in `design.ts`, `field.countersign`

 * in `authz.ts`. The hub's own CTA (`VerdictCard`) is the door to it, so this

 * composition has nothing left to disclaim.

 */
export function OrderRoute(props: { readonly orderId: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <OrderHubScreen orderId={props.orderId} />
      <ExtractionView orderId={props.orderId} />
    </div>
  );
}
