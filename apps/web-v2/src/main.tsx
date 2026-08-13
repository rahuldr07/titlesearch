import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { createQueryClient } from "./app/queryClient";
import { createAppRouter } from "./app/router";
import "./styles/index.css";

/**
 * MSW is the backend until FastAPI lands (BRIEF §7), reusing `packages/mocks`
 * unforked. It is started BEFORE React mounts — otherwise the first queries
 * race the worker's registration and fail intermittently, which is the kind of
 * flake that gets blamed on the test rather than on the wiring.
 */
async function startMockBackend(): Promise<void> {
  const { worker } = await import("@titlepipe/mocks/browser");
  await worker.start({ onUnhandledRequest: "bypass", quiet: true });
}

/**
 * WHICH BACKEND THIS BUNDLE TALKS TO. `mock` is the default because it is
 * today's behaviour, and the default has to be the thing that does not change.
 *
 * `live` starts NO worker, and that is the whole point rather than an
 * optimisation: core-api is migrated endpoint by endpoint, so a build that
 * claims to be live while a registered worker answers first would prove every
 * endpoint works before any of them exists. The Vite proxy that carries `/api`
 * to core-api in this mode is the other half — see vite.config.ts.
 *
 * A value that is neither REFUSES rather than falling back: a typo (`liv`)
 * would otherwise serve mocks under a name saying otherwise, which is exactly
 * the failure this switch exists to make impossible. vite.config.ts warns about
 * the same value at build time and deliberately does NOT refuse there, so that
 * this path stays reachable and testable — see the note beside that warning.
 */
function resolveApiMode(): "mock" | "live" {
  const configured = import.meta.env.VITE_API_MODE ?? "mock";
  if (configured !== "mock" && configured !== "live") {
    throw new Error(`VITE_API_MODE must be "mock" or "live" — got "${configured}".`);
  }
  return configured;
}

/**
 * A WORKER LEFT OVER FROM MOCK MODE IS THE FAILURE THIS APP MUST NOT HIDE.
 *
 * Whether MSW starts is decided when the bundle is BUILT; whether one is
 * already registered is a fact about the browser, and the two are set
 * separately. `pnpm build && VITE_API_MODE=live pnpm preview` produces exactly
 * that mismatch — proxy on, worker on — and the worker answers first, so the
 * operator reads mock rows off a server they believe is live. Every build still
 * ships `mockServiceWorker.js`, so the registration outlives the rebuild that
 * was supposed to have changed modes.
 *
 * Nothing in the build can see this, so the check belongs here, and it REFUSES
 * rather than warns: a console warning loses to a screen full of plausible
 * rows. The message says how to clear it, because a developer moving from mock
 * to live meets this on their first attempt and it must not read as a mystery.
 */
async function refuseAnyRegisteredWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  if (registrations.length === 0) return;
  throw new Error(
    "VITE_API_MODE=live, but a mock service worker is still registered for this " +
      "origin and would answer before core-api does. Unregister it — DevTools → " +
      "Application → Service workers → Unregister — then reload.",
  );
}

/**
 * THE REFUSAL, ON SCREEN. Not error handling: nothing is recovered, nothing is
 * retried, and the app does not mount. Its only job is to put the reason where
 * the person looking at the browser will read it.
 *
 * Plain DOM rather than React, because every reason this can be reached is a
 * reason not to trust that the app boots at all. `role="alert"` and the halt
 * tone match `shared/ui/ScreenMessage`, so a refusal reads as the same kind of
 * event as a screen that failed to load.
 */
function refuseToStart(cause: unknown): void {
  const paragraph = document.createElement("p");
  paragraph.setAttribute("role", "alert");
  paragraph.className = "p-6 text-lg leading-body text-state-halt-ink";
  paragraph.textContent = cause instanceof Error ? cause.message : String(cause);
  (document.getElementById("root") ?? document.body).replaceChildren(paragraph);
  console.error(cause);
}

async function boot(): Promise<void> {
  if (resolveApiMode() === "mock") await startMockBackend();
  else await refuseAnyRegisteredWorker();

  const root = document.getElementById("root");
  if (!root) throw new Error("#root is missing from index.html");

  const queryClient = createQueryClient();
  const router = createAppRouter();

  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}

// `void boot()` alone turned every throw above into an unhandled rejection and
// a white screen, so "refuses rather than falling back" meant, in practice,
// that nobody was ever told why.
void boot().catch(refuseToStart);
