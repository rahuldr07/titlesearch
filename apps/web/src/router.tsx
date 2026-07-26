import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import {
  NotFoundCard,
  RouteErrorCard,
  RoutePending,
} from "./components/fallbacks";
import { GlobalKeys } from "./components/GlobalKeys";
import { SideRail } from "./components/SideRail";
// Home stays eager: it is the landing route, so splitting it would only add a
// pending flash on first paint with nothing to gain. Every other screen is a
// separate chunk, fetched on navigation (and preloaded on hover/focus via
// defaultPreload below) — the 610 KB single bundle becomes a small shell plus
// per-route chunks, so first paint ships only what the landing needs.
import { HomeScreen } from "./screens/Home";
import { ROLE_HOME, requireAccess } from "./nav";
import { session } from "./session";

/**
 * The rail sits beside the screen, not above it. Under /blind/* it is not
 * mounted AT ALL — not merely hidden — so its live-signal hook never fires a
 * single GET from the capture seat: structural blindness holds at the network
 * level, not just visually (blind-blindness.spec proves the zero-GET floor).
 * `min-w-0` lets dense screens (Review, the dark measurement panels) keep
 * owning their own horizontal overflow.
 */
function RootLayout() {
  const onBlind = useRouterState({
    select: (s) => s.location.pathname.startsWith("/blind/"),
  });
  return (
    <div className="flex h-screen">
      {!onBlind && <SideRail />}
      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
      <GlobalKeys />
    </div>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

// "/" is the role-aware hub (Home.tsx) — the map, live. Typists never see
// it: straight to the capture seat (§0.7), before the hub can render or fetch.
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    if (session.role === "typist") {
      throw redirect({ to: ROLE_HOME.typist });
    }
  },
  component: HomeScreen,
});

/*
 * REMOVED IN PASS 1 (2026-07-26) — the four screens design-mock replaces. The
 * SCREENS were deleted; the ROUTES stayed, pointed at RebuildingCard, because
 * the surviving screens cross-link to them and those links are pinned by
 * harvested invariants. Restore each real component in Pass 3 and drop its
 * scaffold: /queue and /escalations are back (2026-07-27) — the escalation
 * inbox returns with the Q11/D1 redraw, the rule step INSIDE resolution. No
 * route still stands on RebuildingCard, so the card is no longer imported here.
 *
 * The order-scoped shape below is worth restoring verbatim: the order is the
 * resource, review is a view of it, and `?field=` as validated search keeps
 * deep links first-class — every escalation, complaint, bench cell and bug
 * report points at the exact field in its exact context.
 */
const queueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/queue",
  beforeLoad: () => requireAccess("/queue"),
  component: lazyRouteComponent(
    () => import("./features/queue/QueueScreen"),
    "QueueScreen",
  ),
});

const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/orders/$orderId/review",
  beforeLoad: () => requireAccess("/orders"),
  validateSearch: (search: Record<string, unknown>): { field?: string } =>
    typeof search["field"] === "string" ? { field: search["field"] } : {},
  component: lazyRouteComponent(
    () => import("./features/review/ReviewScreen"),
    "ReviewScreen",
  ),
});

const ingestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/ingest",
  beforeLoad: () => requireAccess("/ingest"),
  component: lazyRouteComponent(
    () => import("./features/ingest/IngestScreen"),
    "IngestScreen",
  ),
});

const escalationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/escalations",
  beforeLoad: () => requireAccess("/escalations"),
  component: lazyRouteComponent(
    () => import("./features/escalations/EscalationsScreen"),
    "EscalationsScreen",
  ),
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  beforeLoad: () => requireAccess("/dashboard"),
  component: lazyRouteComponent(() => import("./screens/OpsDashboard"), "OpsDashboardScreen"),
});

const deliveryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/delivery",
  beforeLoad: () => requireAccess("/delivery"),
  component: lazyRouteComponent(() => import("./screens/Delivery"), "DeliveryScreen"),
});

const complaintsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/complaints",
  beforeLoad: () => requireAccess("/complaints"),
  component: lazyRouteComponent(() => import("./screens/Complaints"), "ComplaintsScreen"),
});

const goldenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/golden",
  beforeLoad: () => requireAccess("/golden"),
  component: lazyRouteComponent(() => import("./screens/GoldenSet"), "GoldenSetScreen"),
});

const seedCorrectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/seed-correction",
  beforeLoad: () => requireAccess("/seed-correction"),
  validateSearch: (search: Record<string, unknown>): { fieldId?: string } =>
    typeof search["fieldId"] === "string" ? { fieldId: search["fieldId"] } : {},
  component: lazyRouteComponent(() => import("./screens/SeedCorrection"), "SeedCorrectionScreen"),
});

const benchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bench",
  beforeLoad: () => requireAccess("/bench"),
  component: lazyRouteComponent(() => import("./screens/ExtractionBench"), "ExtractionBenchScreen"),
});

const benchResultsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bench/results",
  beforeLoad: () => requireAccess("/bench"),
  component: lazyRouteComponent(() => import("./screens/BenchResults"), "BenchResultsScreen"),
});

const blindRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/blind/$orderId",
  beforeLoad: () => requireAccess("/blind"),
  component: lazyRouteComponent(() => import("./screens/BlindFifty"), "BlindFiftyScreen"),
});

const blindStatusRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/blind-status",
  beforeLoad: () => requireAccess("/blind-status"),
  component: lazyRouteComponent(() => import("./screens/BlindStatus"), "BlindStatusScreen"),
});

const reconciliationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reconciliation/$orderId",
  beforeLoad: () => requireAccess("/reconciliation"),
  component: lazyRouteComponent(() => import("./screens/Reconciliation"), "ReconciliationScreen"),
});

const leaderboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/leaderboard",
  beforeLoad: () => requireAccess("/leaderboard"),
  component: lazyRouteComponent(() => import("./screens/EngineLeaderboard"), "EngineLeaderboardScreen"),
});

// /account carries no guard: every role keeps it in the mock-auth phase so
// the role switch can't lock you out (see nav.ts).
const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/account",
  component: lazyRouteComponent(() => import("./screens/Account"), "AccountScreen"),
});

export const router = createRouter({
  // A wrong address or a render throw gets a coherent card, never a blank
  // page. Both fallbacks are chrome-free — safe even under /blind/*.
  defaultNotFoundComponent: NotFoundCard,
  defaultErrorComponent: RouteErrorCard,
  // While a route's chunk resolves, show the quiet spinner — not a blank frame.
  defaultPendingComponent: RoutePending,
  // Preload the target chunk + loader on hover/focus so the click lands on an
  // already-warm route: navigation feels instant even though screens are split.
  // (Intent preloading is a JS-asset prefetch — it issues no /api call, so the
  // /blind/* zero-GET floor is untouched.)
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
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
