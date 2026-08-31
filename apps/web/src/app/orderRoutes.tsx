import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./rootRoute";
import { orderSearch } from "./orderSearch";
import { OrderRoute } from "./chrome/OrderRoute";
import { WorkstationScreen } from "../features/review/WorkstationScreen";
import { ReleaseScreen } from "../features/release/ReleaseScreen";

/**
 * The order-scoped routes — hand-written because their params buy a
 * compile-time guarantee, while the flat doors in `routeTree.tsx` are looped
 * because they have none. Neither invents a path: authz grants `/orders` as
 * a route prefix, so all live beneath one door.
 */

const parent = () => rootRoute;

/**
 * The order-scoped door, and `?field=` is first-class on it: deep links land
 * on the exact field in context — URL-owned selection. `validateSearch`
 * makes that a typed part of the route, so navigating here with a misspelled
 * search key does not compile. The shape is deliberately narrow and lives in
 * `orderSearch.ts`.
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
 * `/orders/{id}/review` — the workstation, one level below the hub, beneath
 * the same `/orders` door. It is the address the product already uses:
 * Enter on the served order lands here.
 */
const reviewWorkstationRoute = createRoute({
  getParentRoute: parent,
  path: "/orders/$orderId/review",
  validateSearch: orderSearch,
  component: ReviewWorkstationRoute,
});

/**
 * `?field=` is the selection — a cursor held in component state is a cursor
 * nobody can send. `replace` on selection, deliberately: stepping J/K
 * through a queue would otherwise push an entry per field and make the back
 * button walk the reviewer through their own cursor instead of out of the
 * screen. `?page=` is an outright page ask for the evidence pane; the
 * `navigate({ search })` below replaces the whole search string, which is
 * correct — once the cursor moves, the deep-linked page has served its
 * purpose.
 */
function ReviewWorkstationRoute() {
  const { orderId } = reviewWorkstationRoute.useParams();
  const { field, page } = reviewWorkstationRoute.useSearch();
  const navigate = reviewWorkstationRoute.useNavigate();
  return (
    <WorkstationScreen
      orderId={orderId}
      fieldPath={field}
      page={page}
      onSelectField={(path) =>
        void navigate({ search: { field: path }, replace: true })
      }
    />
  );
}

/** `/orders/{id}/release` — the compiler, beneath the same `/orders` door. */
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
