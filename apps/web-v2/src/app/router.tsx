import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { QueueScreen } from "../features/queue/QueueScreen";
import { Eyebrow } from "../shared/ui/Eyebrow";

/**
 * Routes are guards and wiring only — no logic (BRIEF §7). A route's job is to
 * say which feature owns a URL, not to decide anything.
 *
 * Code-based rather than file-based routing: the generated route tree is a
 * build artefact that has to be committed and kept in sync, and this app has
 * few enough routes that the indirection costs more than it saves.
 */
const rootRoute = createRootRoute({
  component: () => (
    <main className="mx-auto max-w-320 p-9">
      <Outlet />
    </main>
  ),
});

/** `/` sends the reviewer to their work rather than to a landing page. */
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
  component: QueueScreen,
});

/**
 * PLACEHOLDER. The review workstation is BRIEF §5's flagship and cannot be
 * built yet: conflicts C8 and C9 need a design redraw — the export's correction
 * has no reason field, and its escalation fabricates one — and both break
 * passing invariants. §13 forbids implementing a screen whose RULE elements are
 * unresolved, so this route exists only so `queue.spec` #5 can assert that
 * Enter navigates to the served order.
 */
const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/orders/$orderId/review",
  component: function ReviewPlaceholder() {
    return (
      <div className="flex flex-col gap-4">
        <Eyebrow variant="screen">Review</Eyebrow>
        <p className="text-base text-ink-secondary">
          Not built yet. Blocked on conflicts C8 and C9 — see
          docs/frontend/conflicts.md.
        </p>
      </div>
    );
  },
});

const routeTree = rootRoute.addChildren([indexRoute, queueRoute, reviewRoute]);

export function createAppRouter() {
  return createRouter({ routeTree, defaultPreload: "intent" });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
