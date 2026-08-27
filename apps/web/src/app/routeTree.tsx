import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./rootRoute";
import { Unbuilt } from "./chrome/Unbuilt";
import { UNBUILT_SCREENS, type ScreenDescriptor } from "./chrome/unbuiltScreens";
import { BLIND_SEAT_SCREEN } from "./chrome/orderScreens";
import { BUILT_SCREENS } from "./chrome/builtScreens";
import { OrderRoute } from "./chrome/OrderRoute";

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

const staticRoutes = UNBUILT_SCREENS.map((descriptor) => {
  const Built = BUILT_SCREENS[descriptor.path];
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
 * The shape is deliberately narrow. `field` is a field id and `page` is a page
 * number, and nothing else: no filter, no sort, no page SIZE. Those would be
 * the browse affordance arriving through the search string after having been
 * refused at the endpoint (endpoints.ts:69, INVARIANTS:82-83).
 *
 * `page` is here because the extraction matrix (design §Screens 6) opens the
 * workstation AT a page, and selection that lives in component state is
 * selection nobody can link to or reload into. It is validated as a finite
 * number rather than trusted: a `page=NaN` pasted into the bar must not reach a
 * component as a number.
 */
const reviewRoute = createRoute({
  getParentRoute: parent,
  path: "/orders/$orderId",
  validateSearch: (
    search: Record<string, unknown>,
  ): { field?: string; page?: number } => {
    const parsed: { field?: string; page?: number } = {};
    if (typeof search["field"] === "string") parsed.field = search["field"];
    const page = Number(search["page"]);
    if (Number.isInteger(page) && page > 0) parsed.page = page;
    return parsed;
  },
  component: ReviewRoute,
});

/** The order id comes off the route, not off a prop nobody could type-check. */
function ReviewRoute() {
  const { orderId } = reviewRoute.useParams();
  return <OrderRoute orderId={orderId} />;
}

/**
 * `/orders/{id}/review` — THE WORKSTATION, one level below the hub, and still
 * beneath the SAME frozen door (`authz.ts:66` grants `/orders` as a route
 * PREFIX, so this invents no path).
 *
 * It is declared HERE rather than left to 404 because it is the address the
 * product already uses: the harvested specs address it in nine places
 * (`chord-suppression`, `errors`, `server-owns-state`, `shell-frame`,
 * `responsive-frame`, the smoke list) and `queue.spec` #5 pins it as where
 * Enter on the served order lands. A door the whole test suite names and the
 * router does not know is a not-found card standing where a screen is expected.
 *
 * It renders the same composition as the hub route for now. The Examination
 * Workstation itself is NOT built and cannot be: the design's T1 second read
 * and countersign have no contract surface at all, and AGENTS.md forbids
 * building past OPEN. `OrderRoute` says so on screen rather than by omission.
 */
const reviewWorkstationRoute = createRoute({
  getParentRoute: parent,
  path: "/orders/$orderId/review",
  component: ReviewWorkstationRoute,
});

function ReviewWorkstationRoute() {
  const { orderId } = reviewWorkstationRoute.useParams();
  return <OrderRoute orderId={orderId} />;
}

const blindSeatRoute = createRoute({
  getParentRoute: parent,
  path: "/blind/$orderId",
  component: () => <Placeholder descriptor={BLIND_SEAT_SCREEN} />,
});

export const routeTree = rootRoute.addChildren([
  ...staticRoutes,
  reviewRoute,
  reviewWorkstationRoute,
  blindSeatRoute,
]);
