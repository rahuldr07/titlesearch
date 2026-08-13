import { defineConfig } from "@playwright/test";

/**
 * E2E suite = the harvested invariants (CONTEXT §14: refusals are product
 * requirements). MSW is the backend — zero real network by design.
 *
 * Every spec in e2e/invariants/ is currently `test.skip`, un-skipped feature by
 * feature during BRIEF §5 Phase 5. A green run today means "nothing regressed",
 * not "the app works" — see e2e/invariants/README.md.
 *
 * Runs against a fresh PRODUCTION BUILD served by `vite preview` on a dedicated
 * port, never a dev server: HMR reloads during a run produce "element resolved
 * but never stable" flake. Port 4274 so a web-v2 run can never collide with an
 * apps/web run on 4273.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // 6-core box: unbounded workers starve Chromium's rAF-based stability checks.
  workers: 3,
  // Headless Chromium starves rAF on fully-idle pages, so the FIRST click on a
  // screen can wait ~6-17s for the two-frame stability check with zero real
  // layout movement. 60s absorbs that one-time stall; it is not masking app
  // slowness. Inherited from apps/web, where it was measured.
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4274",
  },
  webServer: {
    command: "pnpm build && pnpm preview --port 4274 --strictPort",
    /*
     * PINNED, because this build now reads the environment. `VITE_API_MODE`
     * left exported in a shell — the obvious state after debugging the live
     * harness — is inherited by this `pnpm build` and produces a bundle with no
     * MSW at all. MEASURED: `118 passed` becomes `43 passed` in 6.3 minutes,
     * failing as ~75 opaque timeouts rather than as anything that names the
     * cause. This suite is the mock suite by definition, so it says so.
     */
    env: { VITE_API_MODE: "mock" },
    port: 4274,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
