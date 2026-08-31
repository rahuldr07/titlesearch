import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";

import { createQueryClient } from "./app/queryClient";
import { routeTree } from "./app/routeTree";
import { installCrashSink, reportCrash } from "./shared/crash";
/* The fonts are bundled — the Google Fonts <link> this replaced failed
   silently behind restrictive proxies, leaving the app in system fallbacks.
   Bundled woff2 loads from our origin or not at all, and the mono face
   carries citations, where a fallback's metrics would misalign the box. */
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/source-serif-4/opsz.css";
import "./styles.css";

/**
 * `VITE_API_MODE` is inlined at build time, so a bundle carrying a bad
 * value can be produced; the refusal lives here, on screen, where a test
 * can reach it.
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
   * MSW starts before the first render, never alongside it. A worker that
   * registers late lets the first queries escape to the network, where they
   * die against the static server and the screen blames the backend for a
   * race in the client.
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
   * React 19's own error channels — the whole observability story at 0 kB.
   * Sentry is refused: its default breadcrumbs capture DOM click text,
   * console output and fetch URLs, precisely the class of value the
   * backend's redaction exists to remove.
   */
  createRoot(root, {
    /*
     * The `info` React offers each of these is dropped deliberately: it
     * carries `componentStack`, which dev builds fill with source paths and
     * keyed-list `key` values. `crash.ts` does not accept it.
     */
    onUncaughtError: (error) => reportCrash("uncaught", error),
    onCaughtError: (error) => reportCrash("caught", error),
    onRecoverableError: (error) => reportCrash("recoverable", error),
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
