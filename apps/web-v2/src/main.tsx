import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";

import { createQueryClient } from "./app/queryClient";
import { routeTree } from "./app/routeTree";
import { installCrashSink, reportCrash } from "./shared/crash";
import "./styles.css";

/**
 * THE ENTRY POINT, AND THE ONE REFUSAL IT OWNS.
 *
 * `VITE_API_MODE` is inlined at build time, so a bundle carrying a bad value
 * can be produced — `vite.config.ts` explains at length why it warns rather
 * than throws. The refusal lives HERE, where a test can reach it:
 * `e2e-live/refuses-invalid-mode.spec.ts` builds one and asserts this message
 * is on screen.
 */
const apiMode = import.meta.env["VITE_API_MODE"] ?? "mock";

async function start(): Promise<void> {
  const root = document.getElementById("root");
  if (root === null) throw new Error("no #root");

  if (apiMode !== "mock" && apiMode !== "live") {
    root.textContent =
      `VITE_API_MODE is "${apiMode}", which is neither "mock" nor "live". ` +
      `The app will not start against an undefined backend.`;
    return;
  }

  /*
   * MSW starts BEFORE the first render, never alongside it. A worker that
   * registers late lets the first queries escape to the network, which in mock
   * mode means they die against the static server and the screen blames the
   * backend for a race in the client.
   */
  if (apiMode === "mock") {
    const { worker } = await import("@titlepipe/mocks/browser");
    await worker.start({ onUnhandledRequest: "bypass" });
  }

  const queryClient = createQueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
  });

  /*
   * React 19's own error channels, verified present in
   * `@types/react-dom/client.d.ts:37-55`. This is the whole observability
   * story and it costs 0 kB — the dependency spec records why Sentry is
   * refused: its default breadcrumbs capture DOM click text, console output
   * and fetch URLs, which is precisely the class of value the backend's
   * structlog redaction exists to remove (party names, field values, reasons).
   */
  createRoot(root, {
    onUncaughtError: (error, info) => reportCrash("uncaught", error, info),
    onCaughtError: (error, info) => reportCrash("caught", error, info),
    onRecoverableError: (error, info) => reportCrash("recoverable", error, info),
  }).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}

installCrashSink();
void start();
