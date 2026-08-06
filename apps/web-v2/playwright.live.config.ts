import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "@playwright/test";

/**
 * THE MIGRATION SAFETY NET — the harness that lets core-api take endpoints off
 * MSW one at a time without anybody having to trust that it worked.
 *
 * `apps/web-v2/e2e` is the mock suite and MUST NOT CHANGE. This is its sibling
 * so the same specs can later be pointed at a live backend by config alone.
 *
 * FIVE PROJECTS, and the first is the reason the rest mean anything:
 *
 *   live-reaches-core-api     live build, proxy aimed at core-api. THE POSITIVE
 *                             CONTROL. Asserts core-api's own answer arrives in
 *                             the browser. A proxy that is misconfigured, points
 *                             nowhere, or is shadowed by MSW cannot fake it.
 *   live-refuses-stale-worker live build with a worker registered first — the
 *                             mock/live mismatch a rebuild does not clear.
 *   live-halts-without-...    live build, proxy aimed at nothing. The denial.
 *   mock-serves-the-rulebook  mock build. The regression control, and the only
 *                             place the "mock gets NO proxy" rule is checked.
 *   refuses-invalid-mode      a bundle built from a typo'd mode, asserting the
 *                             refusal is legible on screen rather than a white
 *                             page and a console line nobody opens.
 *
 * A denial alone would be satisfied by a working switch, a broken proxy, a
 * typo'd URL and an app that simply does not run — the pure-denial trap that
 * `docs/superpowers/plans/backend/00-HOW-TO-EXECUTE.md` §1.1 measured on Plan
 * 01's isolation suite, where three of nine assertions passed against a
 * mechanism that had been torn out entirely.
 *
 * PORTS: 4275-4278. Never 4274 (the mock e2e run) or 5174 (dev). The bundles
 * live in `dist-harness/` rather than `dist/` for the same reason — see
 * `e2e-live/buildBundles.mjs`, where a shared `dist/` was measured being wiped
 * by the mock suite's own build.
 */
const LIVE_PORT = 4275;
const DOWN_PORT = 4276;
const MOCK_PORT = 4277;
const INVALID_PORT = 4278;

const WEB_V2 = fileURLToPath(new URL(".", import.meta.url));

/** Where core-api actually is. CI and a developer's box are not the same box. */
const CORE_API = process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8000";

/**
 * A port with nothing on it — "core-api is down", made deterministic.
 *
 * Stopping the real process would prove the same thing, and does: run this
 * config with core-api not running and `live-reaches-core-api` fails while this
 * project still passes. Pinning the denial to a dead target as well means the
 * suite states the same result whether or not somebody remembered to stop a
 * server, and means both halves of the proof can run in one pass.
 */
const NOWHERE = process.env.VITE_API_UNREACHABLE_TARGET ?? "http://127.0.0.1:8399";

const LIVE_DIR = "dist-harness/live";
const MOCK_DIR = "dist-harness/mock";
const INVALID_DIR = "dist-harness/invalid";

/** Newest mtime under `dir`, recursively; 0 when the directory is absent. */
function newestMtime(dir: string): number {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestMtime(path) : statSync(path).mtimeMs);
  }
  return newest;
}

/**
 * REFUSE A STALE BUNDLE.
 *
 * Only `pnpm test:e2e:live` chains the build. Somebody debugging a failure will
 * type `pnpm exec playwright test --config playwright.live.config.ts` — the
 * natural invocation — and get whatever was in `dist-harness/` last time. A
 * stale WRONG-MODE bundle fails loudly and is not the problem; a stale
 * RIGHT-MODE one passes silently against yesterday's application, which is a
 * green run that certifies code nobody built.
 *
 * `vite.config.ts` is included in the comparison as well as `src/`, because a
 * change to the proxy is exactly the kind of change this suite exists to catch
 * and it lives outside the source tree.
 */
function refuseStaleBundles(): void {
  const sources = Math.max(
    newestMtime(join(WEB_V2, "src")),
    statSync(join(WEB_V2, "index.html")).mtimeMs,
    statSync(join(WEB_V2, "vite.config.ts")).mtimeMs,
  );

  for (const dir of [LIVE_DIR, MOCK_DIR, INVALID_DIR]) {
    const index = join(WEB_V2, dir, "index.html");
    const built = statSync(index, { throwIfNoEntry: false })?.mtimeMs;
    if (built === undefined || built < sources) {
      throw new Error(
        `${dir} is ${built === undefined ? "missing" : "older than src/"}. ` +
          "The harness bundles are built by e2e-live/buildBundles.mjs, which only " +
          "`pnpm --filter web-v2 test:e2e:live` runs. Use that, or run the script " +
          "by hand first — a stale bundle passes this suite against code nobody built.",
      );
    }
  }
}

refuseStaleBundles();

/**
 * `vite preview` over a PREBUILT directory. Nothing is built here: Playwright
 * starts every webServer before anything else it owns, so the bundles are built
 * by `e2e-live/buildBundles.mjs` first.
 */
function preview(outDir: string, port: number): string {
  return `pnpm exec vite preview --outDir ${outDir} --port ${port} --strictPort`;
}

export default defineConfig({
  testDir: "./e2e-live",
  fullyParallel: true,
  workers: 3,
  // Matches the mock config's budget, and for the same measured reason: headless
  // Chromium starves rAF on an idle page, so the first interaction on a screen
  // can wait many seconds with no real layout movement.
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    // This is the one job in the repository that cannot be reproduced locally —
    // it needs a running core-api and three preview servers — so a CI failure
    // has to arrive with its own evidence. Without these the workflow's artifact
    // upload collects an empty directory.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "live-reaches-core-api",
      testMatch: /reaches-core-api\.spec\.ts$/,
      use: { baseURL: `http://localhost:${LIVE_PORT}` },
    },
    {
      // Same server as above: the mismatch is a fact about the BROWSER, and
      // Playwright gives every test its own context, so registering a worker
      // here cannot leak into the positive control.
      name: "live-refuses-stale-worker",
      testMatch: /refuses-stale-worker\.spec\.ts$/,
      use: { baseURL: `http://localhost:${LIVE_PORT}` },
    },
    {
      name: "live-halts-without-core-api",
      testMatch: /halts-without-core-api\.spec\.ts$/,
      use: { baseURL: `http://localhost:${DOWN_PORT}` },
    },
    {
      name: "mock-serves-the-rulebook",
      testMatch: /mock-unchanged\.spec\.ts$/,
      use: { baseURL: `http://localhost:${MOCK_PORT}` },
    },
    {
      name: "refuses-invalid-mode",
      testMatch: /refuses-invalid-mode\.spec\.ts$/,
      use: { baseURL: `http://localhost:${INVALID_PORT}` },
    },
  ],
  webServer: [
    {
      command: preview(LIVE_DIR, LIVE_PORT),
      port: LIVE_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      // VITE_API_MODE is what makes vite.config.ts define `preview.proxy` at
      // all. It is set on the SERVER here and on the BUILD in buildBundles.mjs,
      // because the two decisions it drives are made at different times.
      env: { VITE_API_MODE: "live", VITE_API_PROXY_TARGET: CORE_API },
    },
    {
      command: preview(LIVE_DIR, DOWN_PORT),
      port: DOWN_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_API_MODE: "live", VITE_API_PROXY_TARGET: NOWHERE },
    },
    {
      command: preview(MOCK_DIR, MOCK_PORT),
      port: MOCK_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      /*
       * THE TARGET IS SET HERE ON PURPOSE, on the server that must NOT use it.
       * `mock-unchanged.spec.ts` asserts that an `/api` call on this origin does
       * not reach core-api; with no target configured, that assertion would hold
       * for the trivial reason that there was nowhere to reach — a proxy pointed
       * at nothing proves nothing. Aiming it at the same live core-api makes the
       * absence of a proxy the only thing keeping the request in.
       */
      env: { VITE_API_MODE: "mock", VITE_API_PROXY_TARGET: CORE_API },
    },
    {
      command: preview(INVALID_DIR, INVALID_PORT),
      port: INVALID_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_API_MODE: "liv", VITE_API_PROXY_TARGET: CORE_API },
    },
  ],
});
