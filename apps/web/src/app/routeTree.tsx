import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./rootRoute";
import { BLIND_SEAT_SCREEN } from "./chrome/orderScreens";
import { accountSearch } from "./accountSearch";
import { AccountScreen } from "../features/account/AccountScreen";
import { staticRoutes, ACCOUNT_PATH } from "./staticRoutes";
import { Placeholder } from "./chrome/Placeholder";
import { orderRoutes } from "./orderRoutes";

/**
 * The routes. Every path is copied from the frozen authz door table — a
 * screen at a path not in it is unreachable by design, and a screen-entry
 * permission guards its route prefix, so the order-scoped forms invent no
 * path. There is deliberately no `/sign-in` route: `rootRoute` renders the
 * sign-in screen instead of the frame at whatever URL the reader asked for,
 * so signing in lands them where they were going.
 *
 * `addChildren` infers the tree from the literal tuple, which is what makes
 * a wrong path or param name a compile error. That only matters where there
 * are params, so the parameterised routes are declared by hand and the flat
 * doors come off the table in a loop.
 */
const parent = () => rootRoute;

const accountRoute = createRoute({
  getParentRoute: parent,
  path: ACCOUNT_PATH,
  validateSearch: accountSearch,
  component: AccountRoute,
});

function AccountRoute() {
  const { tab } = accountRoute.useSearch();
  return <AccountScreen tab={tab} />;
}

const blindSeatRoute = createRoute({
  getParentRoute: parent,
  path: "/blind/$orderId",
  component: () => <Placeholder descriptor={BLIND_SEAT_SCREEN} />,
});

export const routeTree = rootRoute.addChildren([
  ...staticRoutes,
  ...orderRoutes,
  accountRoute,
  blindSeatRoute,
]);
