import { createRootRoute, Outlet } from "@tanstack/react-router";
import { GlobalKeys } from "./GlobalKeys";
import { AppChrome } from "./AppChrome";
import { NotFound } from "./Placeholders";

/**
 * Routes are guards and wiring only — no logic (BRIEF §7).
 *
 * Declared one by one rather than generated from a list: `addChildren` needs
 * the literal tuple to infer the route tree, and that inference is what makes
 * `navigate({ to: "/orders/$orderId/review", params: { orderId } })` a compile
 * error when the path or the param name is wrong. A loop costs fewer lines and
 * throws that away.
 *
 * THERE IS NO ROUTE-LEVEL ROLE GUARD, deliberately. A role's world is enforced
 * two ways the harvested specs actually assert: the door is ABSENT from the hub
 * and the map, and the chord refuses to open it (`roles.spec` ×4). Both read
 * the same `canAccess` table the server gates with, and the server refuses the
 * data regardless — which is the layer that matters.
 */
export const rootRoute = createRootRoute({
  component: () => (
    <>
      <GlobalKeys />
      <AppChrome />
      <main className="mx-auto max-w-400 p-9">
        <Outlet />
      </main>
    </>
  ),
  notFoundComponent: NotFound,
});
