import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./rootRoute";
import { SigninScreen } from "../features/signin/SigninScreen";
import { SessionEndedScreen } from "../features/session/SessionEndedScreen";
import { SurfaceFailureScreen } from "../features/surfacefail/SurfaceFailureScreen";
import { QueueScreen } from "../features/queue/QueueScreen";
import { OverviewScreen } from "../features/overview/OverviewScreen";
import { IngestScreen } from "../features/ingest/IngestScreen";
import { QuestionsScreen } from "../features/questions/QuestionsScreen";
import { ProcessingScreen } from "../features/processing/ProcessingScreen";
import { CompletenessScreen } from "../features/completeness/CompletenessScreen";
import { ReviewScreen } from "../features/review/ReviewScreen";
import { DeliveredScreen } from "../features/delivered/DeliveredScreen";
import { EscalationsScreen } from "../features/escalations/EscalationsScreen";
import { RulebookScreen } from "../features/rulebook/RulebookScreen";
import { ProductsScreen } from "../features/products/ProductsScreen";
import { ClientsScreen } from "../features/clients/ClientsScreen";
import { PeopleScreen } from "../features/people/PeopleScreen";
import { AuditScreen } from "../features/audit/AuditScreen";
import { ProfileScreen } from "../features/profile/ProfileScreen";
import { GalleryScreen } from "../features/gallery/GalleryScreen";

const parent = () => rootRoute;

/**
 * The eighteen screens the approved design draws, and nothing else.
 *
 * `/` IS THE QUEUE, not a hub. The export opens on the queue and draws no hub —
 * work is handed to you, so the first thing you see is the thing you were
 * handed. A landing page listing where you could go is the browsing affordance
 * the queue exists to refuse.
 */
const queueRoute = createRoute({ getParentRoute: parent, path: "/", component: QueueScreen });
const queueAliasRoute = createRoute({ getParentRoute: parent, path: "/queue", component: QueueScreen });
const overviewRoute = createRoute({ getParentRoute: parent, path: "/overview", component: OverviewScreen });

// ── the order flow, in the sequence an order moves through ──────────────────
const ingestRoute = createRoute({ getParentRoute: parent, path: "/ingest", component: IngestScreen });
const questionsRoute = createRoute({ getParentRoute: parent, path: "/questions", component: QuestionsScreen });
const processingRoute = createRoute({ getParentRoute: parent, path: "/processing", component: ProcessingScreen });
const completenessRoute = createRoute({ getParentRoute: parent, path: "/completeness", component: CompletenessScreen });

/** Search-param owned: `?field=` is a first-class deep link (BRIEF §7). */
const reviewRoute = createRoute({
  getParentRoute: parent,
  path: "/orders/$orderId/review",
  validateSearch: (search: Record<string, unknown>): { field?: string } =>
    typeof search["field"] === "string" ? { field: search["field"] } : {},
  component: ReviewScreen,
});
const deliveredRoute = createRoute({ getParentRoute: parent, path: "/delivered", component: DeliveredScreen });
const escalationsRoute = createRoute({ getParentRoute: parent, path: "/escalations", component: EscalationsScreen });

// ── config and admin, reached from the account menu ─────────────────────────
const rulebookRoute = createRoute({ getParentRoute: parent, path: "/rulebook", component: RulebookScreen });
const productsRoute = createRoute({ getParentRoute: parent, path: "/products", component: ProductsScreen });
const clientsRoute = createRoute({ getParentRoute: parent, path: "/clients", component: ClientsScreen });
const peopleRoute = createRoute({ getParentRoute: parent, path: "/people", component: PeopleScreen });
const auditRoute = createRoute({ getParentRoute: parent, path: "/audit", component: AuditScreen });
const profileRoute = createRoute({ getParentRoute: parent, path: "/profile", component: ProfileScreen });

// ── session, and the reference surfaces ─────────────────────────────────────
const signinRoute = createRoute({ getParentRoute: parent, path: "/signin", component: SigninScreen });
const sessionRoute = createRoute({ getParentRoute: parent, path: "/session", component: SessionEndedScreen });
const surfaceFailRoute = createRoute({ getParentRoute: parent, path: "/surface-failure", component: SurfaceFailureScreen });
const galleryRoute = createRoute({ getParentRoute: parent, path: "/gallery", component: GalleryScreen });

export const routeTree = rootRoute.addChildren([
  queueRoute, queueAliasRoute, overviewRoute, ingestRoute,
  questionsRoute, processingRoute, completenessRoute, reviewRoute,
  deliveredRoute, escalationsRoute, rulebookRoute, productsRoute,
  clientsRoute, peopleRoute, auditRoute, profileRoute,
  signinRoute, sessionRoute, surfaceFailRoute, galleryRoute,
]);
