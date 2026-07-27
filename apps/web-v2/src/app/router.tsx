import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { QueueScreen } from "../features/queue/QueueScreen";
import { AccountScreen } from "../features/account/AccountScreen";
import { HomeHub } from "../features/home/HomeHub";
import { BlindSeat } from "../features/blind/BlindSeat";
import { OpsDashboard } from "../features/dashboard/OpsDashboard";
import { LeaderboardScreen } from "../features/leaderboard/LeaderboardScreen";
import { DeliveryScreen } from "../features/delivery/DeliveryScreen";
import { ComplaintsScreen } from "../features/complaints/ComplaintsScreen";
import { GoldenSet } from "../features/golden/GoldenSet";
import { SeedCorrection } from "../features/seedCorrection/SeedCorrection";
import { GlobalKeys } from "./GlobalKeys";
import { NotBuiltYet, NotFound } from "./Placeholders";

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
const rootRoute = createRootRoute({
  component: () => (
    <>
      <GlobalKeys />
      <main className="mx-auto max-w-320 p-9">
        <Outlet />
      </main>
    </>
  ),
  notFoundComponent: NotFound,
});

const parent = () => rootRoute;
const pending = (why: string) => () => <NotBuiltYet why={why} />;

const MEASUREMENT =
  "Not built yet — one of the twelve measurement screens being re-platformed onto the new tokens.";

// ── built ───────────────────────────────────────────────────────────────────
const homeRoute = createRoute({ getParentRoute: parent, path: "/", component: HomeHub });
const queueRoute = createRoute({ getParentRoute: parent, path: "/queue", component: QueueScreen });
const accountRoute = createRoute({ getParentRoute: parent, path: "/account", component: AccountScreen });

// ── not built: each says WHY, rather than rendering an empty shell ───────────
const reviewRoute = createRoute({
  getParentRoute: parent,
  path: "/orders/$orderId/review",
  component: pending(
    "Blocked on conflicts C8 and C9 — the export's correction has no reason field, and its escalation fabricates one. Both break passing invariants, and §13 forbids building a screen whose RULE elements are unresolved. See docs/frontend/conflicts.md.",
  ),
});
const escalationsRoute = createRoute({
  getParentRoute: parent,
  path: "/escalations",
  component: pending("Not built yet. Ruling D1 settled that resolution requires a rule; the screen is next."),
});
const ingestRoute = createRoute({
  getParentRoute: parent,
  path: "/ingest",
  component: pending("Blocked on rulings Q4–Q10 — the intake and config layer has no backend counterpart yet."),
});
const dashboardRoute = createRoute({ getParentRoute: parent, path: "/dashboard", component: OpsDashboard });
const complaintsRoute = createRoute({ getParentRoute: parent, path: "/complaints", component: ComplaintsScreen });
const deliveryRoute = createRoute({ getParentRoute: parent, path: "/delivery", component: DeliveryScreen });
const blindStatusRoute = createRoute({ getParentRoute: parent, path: "/blind-status", component: pending(MEASUREMENT) });
const benchRoute = createRoute({ getParentRoute: parent, path: "/bench", component: pending(MEASUREMENT) });
const leaderboardRoute = createRoute({ getParentRoute: parent, path: "/leaderboard", component: LeaderboardScreen });
const goldenRoute = createRoute({ getParentRoute: parent, path: "/golden", component: GoldenSet });

/**
 * SEED CORRECTION TAKES ITS FIELD FROM THE QUERY STRING, and a missing one is a
 * first-class state rather than a redirect. `navigation.spec` #5: the screen has
 * no menu entry, so arriving without context means the LINK is missing — and
 * bouncing to a picker would answer that by inventing the browsing affordance
 * the screen exists without.
 */
const seedCorrectionRoute = createRoute({
  getParentRoute: parent,
  path: "/seed-correction",
  validateSearch: (search: Record<string, unknown>): { fieldId: string } => ({
    fieldId: typeof search["fieldId"] === "string" ? search["fieldId"] : "",
  }),
  component: SeedCorrection,
});
const reconciliationRoute = createRoute({ getParentRoute: parent, path: "/reconciliation", component: pending(MEASUREMENT) });
const blindRoute = createRoute({
  getParentRoute: parent,
  path: "/blind/$orderId",
  component: BlindSeat,
});

const routeTree = rootRoute.addChildren([
  homeRoute, queueRoute, accountRoute, reviewRoute, escalationsRoute, ingestRoute,
  dashboardRoute, complaintsRoute, deliveryRoute, blindStatusRoute, benchRoute,
  leaderboardRoute, goldenRoute, reconciliationRoute, blindRoute, seedCorrectionRoute,
]);

export function createAppRouter() {
  return createRouter({ routeTree, defaultPreload: "intent" });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
