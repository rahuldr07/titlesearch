import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
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
 * but never stable" flake.
 */

/**
 * THE PORT IS PER-CHECKOUT, NOT PER-MACHINE.
 *
 * It was pinned to 4274, on the reasoning that a `web-v2` run could then never
 * collide with an `apps/web` run on 4273. That reasoning was about two
 * DIRECTORIES in one checkout, and `web-v2` no longer exists. The topology that
 * does exist is several git WORKTREES of this repository, each a full copy of
 * `apps/web`, each running `pnpm test:e2e` from its own directory against one
 * shared loopback interface. A pinned port plus `--strictPort` plus
 * `reuseExistingServer: false` means the second run to start does not queue
 * behind the first or quietly attach to it: it fails to bind, and the whole run
 * dies before a single spec executes.
 *
 * So the port is derived from the absolute path of THIS FILE — the one thing
 * that is different for every worktree and identical for every run inside one.
 * Same worktree, same port, every time; two worktrees, two ports.
 *
 * `--strictPort` STAYS. A derived port is not a guaranteed-free port: the span
 * is finite, so two worktrees can hash to the same slot, and something
 * unrelated may already hold it. Binding is the only check that exists, and
 * failing to bind is the correct answer — the alternative is attaching to a
 * preview server someone else built and reporting their bundle as your result.
 * `TITLEPIPE_E2E_PORT` is the escape hatch when that happens.
 *
 * Span 4400-4999: clear of 4275-4278 (`playwright.live.config.ts`, whose four
 * ports have this same per-machine defect and are NOT fixed here — see the note
 * at the end of this comment), 5174 (dev) and 8000 (core-api).
 *
 * UNPROVEN RESIDUAL: nothing enforces the "two worktrees, two ports" property.
 * The only machine that would enforce it is a second concurrent run, which no
 * suite in this repository starts. What is checked here is the input validation
 * on the override and the fact that the value is a function of the path; the
 * live harness above still pins 4275-4278 for every worktree on the box.
 */
const PORT_ENV = "TITLEPIPE_E2E_PORT";
const PORT_BASE = 4400;
const PORT_SPAN = 600;

function previewPort(): number {
  const override = process.env[PORT_ENV];
  if (override !== undefined && override !== "") {
    const port = Number(override);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      throw new Error(
        `${PORT_ENV}=${override} is not a port. Give an integer in 1024-65535, ` +
          "or unset it and let the port be derived from this worktree's path.",
      );
    }
    return port;
  }
  // The directory this config lives in, absolute: `…/<worktree>/apps/web/`.
  const here = fileURLToPath(new URL(".", import.meta.url));
  const digest = createHash("sha256").update(here).digest();
  return PORT_BASE + (digest.readUInt16BE(0) % PORT_SPAN);
}

const PORT = previewPort();

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
    baseURL: `http://localhost:${String(PORT)}`,
  },
  webServer: {
    command: `pnpm build && pnpm preview --port ${String(PORT)} --strictPort`,
    /*
     * PINNED, because this build now reads the environment. `VITE_API_MODE`
     * left exported in a shell — the obvious state after debugging the live
     * harness — is inherited by this `pnpm build` and produces a bundle with no
     * MSW at all. MEASURED: `118 passed` becomes `43 passed` in 6.3 minutes,
     * failing as ~75 opaque timeouts rather than as anything that names the
     * cause. This suite is the mock suite by definition, so it says so.
     */
    env: { VITE_API_MODE: "mock" },
    port: PORT,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
