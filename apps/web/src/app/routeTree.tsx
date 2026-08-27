import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./rootRoute";
import { Unbuilt } from "./chrome/Unbuilt";
import { UNBUILT_SCREENS, type ScreenDescriptor } from "./chrome/unbuiltScreens";
import { BLIND_SEAT_SCREEN, REVIEW_SCREEN } from "./chrome/orderScreens";
import { IngestScreen } from "../features/ingest/IngestScreen";
import { EscalationsScreen } from "../features/escalations/EscalationsScreen";
import { DeliveryScreen } from "../features/delivery/DeliveryScreen";

/**
 * THE ROUTES, AND EVERY PATH IS COPIED FROM `authz.ts:62-81`.
 *
 * That table is frozen and it IS the door list: a screen at a path not in it is
 * unreachable by design. So this file invents no path, and the two shapes below
 * that look like additions are not:
 *
 *   - `/orders/$orderId` is the ORDER-SCOPED form of the `/orders` door.
 *     `authz.ts:50` says a screen-entry permission "guards this route PREFIX",
 *     so the door covers everything beneath it. `screen.review.enter` is
 *     `SIGHTED` — reviewer works it, senior/ops/engineer arrive via
 *     context-carrying deep links (authz.ts:64-66).
 *   - `/blind/$orderId` is likewise the order-scoped form of `/blind`.
 *
 * THERE IS NO `/sign-in` ROUTE, and its absence is the design working. The
 * sign-in screen is what `rootRoute` renders INSTEAD OF the frame when there is
 * no session, at whatever URL the reader asked for — so signing in lands them
 * where they were going rather than at the root. A `/sign-in` path would also
 * be a door that is not in the frozen table.
 *
 * ══ WHY EVERY SCREEN BELOW IS A PLACEHOLDER ════════════════════════════════
 *
 * `Unbuilt` names what the screen is, which contract surface it binds to, and
 * what is missing. It is deliberately NOT a transcription of the design
 * prototype's markup: that markup is full of values — order refs, counts,
 * addresses, a "128 cited" headline — and root AGENTS.md forbids emitting a
 * value that cannot be cited. A convincing mock reads as finished to everybody
 * who opens it, which is worse than an honest gap.
 *
 * ══ WHY THE FLAT SCREENS ARE A LOOP AND THE TWO ORDER-SCOPED ONES ARE NOT ══
 *
 * `addChildren` infers the route tree from the literal tuple, and that
 * inference is what makes `navigate({ to: "/orders/$orderId", params })` a
 * COMPILE error when the path or param name is wrong. That guarantee only
 * matters where there ARE params, so the two parameterised routes are declared
 * by hand and keep it, while the fifteen static doors — which cannot have a
 * wrong param because they have none — come off the table. Loop where the
 * types buy nothing, hand-write where they buy something.
 */
const parent = () => rootRoute;

/**
 * A DOOR THAT IS BUILT REPLACES ITS PLACEHOLDER BY PATH.
 *
 * `UNBUILT_SCREENS` stays the complete door list — it is what the rail and the
 * command palette read, and removing an entry as each screen lands would make
 * the list mean "unbuilt" in one file and "all doors" in another. So the table
 * keeps every path and this map names the ones that now have a screen. A path
 * here that is not in the table renders nowhere, which is the failure mode we
 * want: the frozen table (authz.ts:62-81) stays the only source of doors.
 */
const BUILT: Readonly<Record<string, () => React.JSX.Element>> = {
  "/ingest": IngestScreen,
};

const staticRoutes = UNBUILT_SCREENS.map((descriptor) => {
  const Built = BUILT[descriptor.path];
  return createRoute({
    getParentRoute: parent,
    path: descriptor.path,
    component:
      Built === undefined ? () => <Placeholder descriptor={descriptor} /> : Built,
  });
});

function Placeholder(props: { readonly descriptor: ScreenDescriptor }) {
  return (
    <Unbuilt
      screen={props.descriptor.screen}
      door={props.descriptor.path}
      binds={props.descriptor.binds}
      missing={props.descriptor.missing}
    />
  );
}

/**
 * THE ORDER-SCOPED DOOR, and `?field=` is first-class on it.
 *
 * INVARIANT 55: deep links land on the exact field in context — URL-owned
 * selection. `validateSearch` is what makes that a TYPED part of the route
 * rather than a query string somebody remembers to read: navigating here with
 * a misspelled search key does not compile.
 *
 * The shape is deliberately narrow. `field` is a field id and nothing else: no
 * filter, no sort, no page. Those would be the browse affordance arriving
 * through the search string after having been refused at the endpoint
 * (endpoints.ts:69, INVARIANTS:82-83).
 */
const reviewRoute = createRoute({
  getParentRoute: parent,
  path: "/orders/$orderId",
  validateSearch: (search: Record<string, unknown>): { field?: string } =>
    typeof search["field"] === "string" ? { field: search["field"] } : {},
  component: () => <Placeholder descriptor={REVIEW_SCREEN} />,
});

const blindSeatRoute = createRoute({
  getParentRoute: parent,
  path: "/blind/$orderId",
  component: () => <Placeholder descriptor={BLIND_SEAT_SCREEN} />,
});

/**
 * THE BUILT SCREENS, AT THE SAME FROZEN PATHS.
 *
 * Both paths are copied from `authz.ts:68` and `authz.ts:70`; nothing here is
 * invented. They are declared beside the placeholder loop rather than inside
 * it because a built screen is no longer described by `UNBUILT_SCREENS` — its
 * entry is REMOVED from that table when the screen lands, since a door cannot
 * simultaneously be built and describe itself as missing. The table shrinking
 * is how the remaining work stays legible.
 */
const escalationsRoute = createRoute({
  getParentRoute: parent,
  path: "/escalations",
  component: EscalationsScreen,
});

const deliveryRoute = createRoute({
  getParentRoute: parent,
  path: "/delivery",
  component: DeliveryScreen,
});

export const routeTree = rootRoute.addChildren([
  ...staticRoutes,
  escalationsRoute,
  deliveryRoute,
  reviewRoute,
  blindSeatRoute,
]);
