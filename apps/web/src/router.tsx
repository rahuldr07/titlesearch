import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { AccountScreen } from "./screens/Account";
import { GlobalKeys } from "./components/GlobalKeys";
import { BenchResultsScreen } from "./screens/BenchResults";
import { BlindFiftyScreen } from "./screens/BlindFifty";
import { BlindStatusScreen } from "./screens/BlindStatus";
import { ReconciliationScreen } from "./screens/Reconciliation";
import { ComplaintsScreen } from "./screens/Complaints";
import { ExtractionBenchScreen } from "./screens/ExtractionBench";
import { DeliveryScreen } from "./screens/Delivery";
import { EngineLeaderboardScreen } from "./screens/EngineLeaderboard";
import { EscalationInboxScreen } from "./screens/EscalationInbox";
import { GoldenSetScreen } from "./screens/GoldenSet";
import { IngestScreen } from "./screens/Ingest";
import { OpsDashboardScreen } from "./screens/OpsDashboard";
import { SeedCorrectionScreen } from "./screens/SeedCorrection";
import { QueueScreen } from "./screens/Queue";
import { ReviewScreen } from "./screens/Review";
import { requireAccess } from "./nav";

function RootLayout() {
  return (
    <>
      <Outlet />
      <GlobalKeys />
    </>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/queue" });
  },
});

const queueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/queue",
  beforeLoad: () => requireAccess("/queue"),
  component: QueueScreen,
});

/**
 * Order-scoped shape (`/orders/$id/review`): the order is the resource, review
 * is a view of it — future order views (timeline, report) share the prefix.
 * Deep links are first-class: every escalation, complaint, bench cell, and
 * bug report can point at the exact field in its exact context via `?field=`.
 */
const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/orders/$orderId/review",
  beforeLoad: () => requireAccess("/orders"),
  validateSearch: (search: Record<string, unknown>): { field?: string } =>
    typeof search["field"] === "string" ? { field: search["field"] } : {},
  component: ReviewScreen,
});

const ingestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/ingest",
  beforeLoad: () => requireAccess("/ingest"),
  component: IngestScreen,
});

const escalationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/escalations",
  beforeLoad: () => requireAccess("/escalations"),
  component: EscalationInboxScreen,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  beforeLoad: () => requireAccess("/dashboard"),
  component: OpsDashboardScreen,
});

const deliveryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/delivery",
  beforeLoad: () => requireAccess("/delivery"),
  component: DeliveryScreen,
});

const complaintsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/complaints",
  beforeLoad: () => requireAccess("/complaints"),
  component: ComplaintsScreen,
});

const goldenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/golden",
  beforeLoad: () => requireAccess("/golden"),
  component: GoldenSetScreen,
});

const seedCorrectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/seed-correction",
  beforeLoad: () => requireAccess("/seed-correction"),
  validateSearch: (search: Record<string, unknown>): { fieldId?: string } =>
    typeof search["fieldId"] === "string" ? { fieldId: search["fieldId"] } : {},
  component: SeedCorrectionScreen,
});

const benchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bench",
  beforeLoad: () => requireAccess("/bench"),
  component: ExtractionBenchScreen,
});

const benchResultsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bench/results",
  beforeLoad: () => requireAccess("/bench"),
  component: BenchResultsScreen,
});

const blindRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/blind/$orderId",
  beforeLoad: () => requireAccess("/blind"),
  component: BlindFiftyScreen,
});

const blindStatusRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/blind-status",
  beforeLoad: () => requireAccess("/blind-status"),
  component: BlindStatusScreen,
});

const reconciliationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reconciliation/$orderId",
  beforeLoad: () => requireAccess("/reconciliation"),
  component: ReconciliationScreen,
});

const leaderboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/leaderboard",
  beforeLoad: () => requireAccess("/leaderboard"),
  component: EngineLeaderboardScreen,
});

// /account carries no guard: every role keeps it in the mock-auth phase so
// the role switch can't lock you out (see nav.ts).
const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/account",
  component: AccountScreen,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute,
    queueRoute,
    reviewRoute,
    ingestRoute,
    escalationsRoute,
    dashboardRoute,
    deliveryRoute,
    complaintsRoute,
    goldenRoute,
    seedCorrectionRoute,
    benchRoute,
    benchResultsRoute,
    blindRoute,
    blindStatusRoute,
    reconciliationRoute,
    leaderboardRoute,
    accountRoute,
  ]),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
