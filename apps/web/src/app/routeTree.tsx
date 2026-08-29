import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./rootRoute";
import { BLIND_SEAT_SCREEN } from "./chrome/orderScreens";
import { accountSearch } from "./accountSearch";
import { AccountScreen } from "../features/account/AccountScreen";
import { staticRoutes, ACCOUNT_PATH, Placeholder } from "./staticRoutes";
import { orderRoutes } from "./orderRoutes";

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
