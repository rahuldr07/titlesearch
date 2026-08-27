import { ExtractionView } from "../../features/extraction/ExtractionView";
import { OrderHubScreen } from "../../features/hub/OrderHubScreen";
import { Unbuilt } from "./Unbuilt";
import { REVIEW_SCREEN } from "./orderScreens";

/**
 * THE ORDER-SCOPED DOOR, WHICH IS THREE SCREENS' WORTH OF DESIGN AND ONE ROUTE.
 *
 * `authz.ts:66` grants `/orders` as a route PREFIX, and the frozen door table
 * has no path for extraction — `ANALYSIS-screens.md` §1 row 6 places screen 6
 * at `/orders/{id}` as a sub-view for exactly that reason. So this composes
 * what the contract can serve with what it cannot, in the order a reader meets
 * them:
 *
 *   - THE HUB (screen 4) is BUILT, and it leads because it is where the door
 *     lands: the verdict, the census, the gate, the specifications and the
 *     event trail are what a reader wants before they want a page matrix.
 *     `OrderContextResponse` (intake.ts:301), `OrderCensus` (endpoints.ts:160),
 *     `OrderCompletenessResponse` (intake.ts:173), `OrderSignoffResponse`
 *     (intake.ts:64) and `OrderTimelineResponse` (endpoints.ts:579) back all of
 *     it, and every count on it is the server's verbatim.
 *   - EXTRACTION (screen 6) is BUILT. `OrderPipelineResponse` (intake.ts:92)
 *     and `OrderPagesResponse` (endpoints.ts:654) back all of it except the
 *     run-log terminal, which is refused rather than missing.
 *   - REVIEW / the Examination Workstation (screen 7) is NOT, and the reason is
 *     the largest gap in the build: the design's T1 second read and countersign
 *     have no contract surface at all (backend conversation 1). A countersign
 *     with no shape is `OPEN`, and root AGENTS.md forbids building past OPEN.
 *
 * The placeholder sits BELOW the extraction view rather than instead of it. A
 * door that renders only its missing half tells a reader nothing about the half
 * that works, and a door that renders only its working half quietly implies the
 * screen is finished.
 *
 * THE HUB AND THE EXTRACTION VIEW BOTH DRAW THE PIPELINE STAGES, and they draw
 * the SAME query (`shared/queries.ts` gives `/api/orders/{id}/pipeline` one
 * path and one cache key), so they cannot disagree and the second read costs
 * nothing. Rule 11 — one variable, never two literals — applied to a cache key.
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
