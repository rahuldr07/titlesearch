import { defineConfig } from "@playwright/test";

/**
 * E2E suite = the refusal/invariant tests (CONTEXT §14: refusals are product
 * requirements). MSW is the backend — zero real network by design.
 *
 * Runs against a fresh PRODUCTION BUILD served by `vite preview` on a
 * dedicated port — never a dev server. HMR reloads and editor saves during a
 * run were producing "element resolved but never stable" flake; a static
 * preview has no HMR and `reuseExistingServer: false` guarantees no test run
 * ever rides someone's live dev session.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // 6-core box: unbounded workers starve Chromium's rAF-based stability
  // checks (measured: a click that needs ~6s solo blows the 30s timeout
  // under full contention, with zero actual layout movement).
  workers: 3,
  // Headless Chromium starves rAF on fully-idle pages, so the FIRST click on
  // a screen can wait ~6–17s for the two-frame stability check with zero real
  // layout movement (instrumented: box deltas 0, CLS 0, no animations, node
  // never remounted). Subsequent actions are instant. 60s absorbs the
  // one-time stall; it is not masking app slowness.
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4273",
  },
  webServer: {
    command: "pnpm build && pnpm preview --port 4273 --strictPort",
    port: 4273,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
