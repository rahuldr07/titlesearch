import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./rootRoute";
import { AuditScreen } from "../features/audit/AuditScreen";
import { CompletenessScreen } from "../features/completeness/CompletenessScreen";
import { DeliveredScreen } from "../features/delivered/DeliveredScreen";
import { RulebookScreen } from "../features/rulebook/RulebookScreen";
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
import { ExtractionBench } from "../features/bench/ExtractionBench";
import { BenchResults } from "../features/bench/BenchResults";
import { EscalationsScreen } from "../features/escalations/EscalationsScreen";
import { ReviewScreen } from "../features/review/ReviewScreen";
import { IngestScreen } from "../features/ingest/IngestScreen";
import { PeopleScreen } from "../features/people/PeopleScreen";
import { ProfileScreen } from "../features/profile/ProfileScreen";
import { ReconciliationScreen } from "../features/reconciliation/ReconciliationScreen";
import { ReconciliationIndex } from "../features/reconciliation/ReconciliationIndex";
import { BlindStatus } from "../features/blindStatus/BlindStatus";
import { OverviewScreen } from "../features/overview/OverviewScreen";
import { QuestionsScreen } from "../features/questions/QuestionsScreen";
import { ProcessingScreen } from "../features/processing/ProcessingScreen";
import { SigninScreen } from "../features/signin/SigninScreen";
import { SessionEndedScreen } from "../features/session/SessionEndedScreen";
import { SurfaceFailureScreen } from "../features/surfacefail/SurfaceFailureScreen";
import { ProductsScreen } from "../features/products/ProductsScreen";
import { GalleryScreen } from "../features/gallery/GalleryScreen";

const parent = () => rootRoute;

// ── built ───────────────────────────────────────────────────────────────────
const homeRoute = createRoute({ getParentRoute: parent, path: "/", component: HomeHub });
const queueRoute = createRoute({ getParentRoute: parent, path: "/queue", component: QueueScreen });
const accountRoute = createRoute({ getParentRoute: parent, path: "/account", component: AccountScreen });

// ── not built: each says WHY, rather than rendering an empty shell ───────────
/**
 * SELECTION IS URL-OWNED. `?field=` is a first-class deep link (BRIEF §7): a
 * complaint, an escalation or a colleague's message points at the exact field
 * in context, and the destination is never asked to re-derive which one.
 */
const reviewRoute = createRoute({
  getParentRoute: parent,
  path: "/orders/$orderId/review",
  validateSearch: (search: Record<string, unknown>): { field?: string } =>
    typeof search["field"] === "string" ? { field: search["field"] } : {},
  component: ReviewScreen,
});
const escalationsRoute = createRoute({ getParentRoute: parent, path: "/escalations", component: EscalationsScreen });
const ingestRoute = createRoute({ getParentRoute: parent, path: "/ingest", component: IngestScreen });
const dashboardRoute = createRoute({ getParentRoute: parent, path: "/dashboard", component: OpsDashboard });
const complaintsRoute = createRoute({ getParentRoute: parent, path: "/complaints", component: ComplaintsScreen });
const deliveryRoute = createRoute({ getParentRoute: parent, path: "/delivery", component: DeliveryScreen });
const blindStatusRoute = createRoute({ getParentRoute: parent, path: "/blind-status", component: BlindStatus });
const benchRoute = createRoute({ getParentRoute: parent, path: "/bench", component: ExtractionBench });
const benchResultsRoute = createRoute({ getParentRoute: parent, path: "/bench/results", component: BenchResults });
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
const reconciliationRoute = createRoute({ getParentRoute: parent, path: "/reconciliation", component: ReconciliationIndex });
const reconciliationOrderRoute = createRoute({ getParentRoute: parent, path: "/reconciliation/$orderId", component: ReconciliationScreen });
const peopleRoute = createRoute({ getParentRoute: parent, path: "/people", component: PeopleScreen });
const profileRoute = createRoute({ getParentRoute: parent, path: "/profile", component: ProfileScreen });
const overviewScreenRoute = createRoute({ getParentRoute: parent, path: "/overview", component: OverviewScreen });
const questionsScreenRoute = createRoute({ getParentRoute: parent, path: "/questions", component: QuestionsScreen });
const processingScreenRoute = createRoute({ getParentRoute: parent, path: "/processing", component: ProcessingScreen });
const signinScreenRoute = createRoute({ getParentRoute: parent, path: "/signin", component: SigninScreen });
const sessionEndedScreenRoute = createRoute({ getParentRoute: parent, path: "/session", component: SessionEndedScreen });
const surfaceFailureScreenRoute = createRoute({ getParentRoute: parent, path: "/surface-failure", component: SurfaceFailureScreen });
const productsScreenRoute = createRoute({ getParentRoute: parent, path: "/products", component: ProductsScreen });
const galleryScreenRoute = createRoute({ getParentRoute: parent, path: "/gallery", component: GalleryScreen });
const auditScreenRoute = createRoute({ getParentRoute: parent, path: "/audit", component: AuditScreen });
const completenessScreenRoute = createRoute({ getParentRoute: parent, path: "/completeness", component: CompletenessScreen });
const deliveredScreenRoute = createRoute({ getParentRoute: parent, path: "/delivered", component: DeliveredScreen });
const rulebookScreenRoute = createRoute({ getParentRoute: parent, path: "/rulebook", component: RulebookScreen });
const blindRoute = createRoute({
  getParentRoute: parent,
  path: "/blind/$orderId",
  component: BlindSeat,
});

export const routeTree = rootRoute.addChildren([
  auditScreenRoute, completenessScreenRoute, deliveredScreenRoute, rulebookScreenRoute,
  homeRoute, queueRoute, accountRoute, reviewRoute,
  escalationsRoute, ingestRoute, dashboardRoute, complaintsRoute,
  deliveryRoute, blindStatusRoute, benchRoute, benchResultsRoute,
  leaderboardRoute, goldenRoute, reconciliationRoute, reconciliationOrderRoute,
  blindRoute, seedCorrectionRoute, peopleRoute, profileRoute,
  productsScreenRoute, galleryScreenRoute, overviewScreenRoute, questionsScreenRoute,
  processingScreenRoute, signinScreenRoute, sessionEndedScreenRoute, surfaceFailureScreenRoute,
]);
