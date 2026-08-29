import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./rootRoute";
import { orderSearch } from "./orderSearch";
import { OrderRoute } from "./chrome/OrderRoute";
import { WorkstationScreen } from "../features/review/WorkstationScreen";
import { ReleaseScreen } from "../features/release/ReleaseScreen";

/**
 * THE TWO ORDER-SCOPED ROUTES, split out of `routeTree.tsx` on the 150-line
 * gate — and the seam is the one that file already argues: these are the routes
 * hand-written because their PARAMS buy a compile-time guarantee, while the
 * flat doors are looped because they have none.
 *
 * Neither invents a path. `authz.ts:65` grants `/orders` as a route PREFIX, so
 * both live beneath one frozen door.
 */

const parent = () => rootRoute;

/**
 * THE ORDER-SCOPED DOOR, and `?field=` is first-class on it.
 *
 * INVARIANT 55: deep links land on the exact field in context — URL-owned
 * selection. `validateSearch` is what makes that a TYPED part of the route
 * rather than a query string somebody remembers to read: navigating here with
 * a misspelled search key does not compile.
 *
 * The shape is deliberately narrow and lives in `orderSearch.ts`, which
 * carries the argument for each of its two keys and for everything absent.
 */
const reviewRoute = createRoute({
  getParentRoute: parent,
  path: "/orders/$orderId",
  validateSearch: orderSearch,
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
  validateSearch: orderSearch,
  component: ReviewWorkstationRoute,
});

/**
 * `?field=` IS THE SELECTION, on this route as on the hub's.
 *
 * INVARIANT 55 — deep links land on the exact field in context, URL-owned. The
 * workstation is where that matters most: "the vested owner on 4176034-1 is
 * wrong" is a link somebody pastes into a message, and a cursor held in
 * component state is a cursor nobody can send.
 *
 * `replace` on selection, deliberately. Stepping J/K through a queue of
 * nineteen fields would otherwise push nineteen history entries and make the
 * back button walk the reviewer backwards through their own cursor instead of
 * out of the screen.
 */
function ReviewWorkstationRoute() {
  const { orderId } = reviewWorkstationRoute.useParams();
  const { field } = reviewWorkstationRoute.useSearch();
  const navigate = reviewWorkstationRoute.useNavigate();
  return (
    <WorkstationScreen
      orderId={orderId}
      fieldPath={field}
      onSelectField={(path) =>
        void navigate({ search: { field: path }, replace: true })
      }
    />
  );
}

/**
 * SCREEN 12 — Settings & RBAC, the one FLAT door off the static loop, because
 * it is the only one carrying a search key: `validateSearch` buys it the order
 * routes' guarantee. See `accountSearch.ts`.
 */

/** `/orders/{id}/release` — the compiler, beneath the same frozen `/orders` door. */
const releaseRoute = createRoute({
  getParentRoute: parent,
  path: "/orders/$orderId/release",
  component: ReleaseRoute,
});

function ReleaseRoute() {
  const { orderId } = releaseRoute.useParams();
  return <ReleaseScreen orderId={orderId} />;
}

export const orderRoutes = [reviewRoute, reviewWorkstationRoute, releaseRoute];
