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
 * SIX PROJECTS, and the first is the reason the rest mean anything:
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
 *   live-frozen-rulebook      `apps/web-v2/e2e` itself — the frozen mock suite,
 *                             unmodified — pointed at the live build. BREADTH,
 *                             NOT PROOF. See the selection block below.
 *
 * 🔴 `live-reaches-core-api` IS THE ONLY PROJECT THAT FAILS WHEN THE SWITCH, THE
 *    PROXY OR THE BUILD IS BROKEN. That is a fact about all five of the others,
 *    and it is stated here in the plain form because a softer version of it was
 *    in this file and was wrong. The label on `live-frozen-rulebook` read "THE
 *    DELIVERABLE"; MEASURED 2026-08-06, changing that project's `baseURL` from
 *    `LIVE_PORT` to `MOCK_PORT` — one line, and exactly the "MSW left running"
 *    state this whole harness exists to catch — leaves it 7 of 7 GREEN. It is
 *    satisfied by any HTTP server that returns `{rules:[…]}` in the right shape,
 *    and establishes nothing about core-api, Postgres, or the switch.
 *
 * THE HARNESS NOW HAS A DATABASE, decided in Plan 02 Task 5 and previously
 * deferred by `reaches-core-api.spec.ts`. Its positive control asserted a 503
 * because core-api was booted with no `TITLEPIPE_APP_DATABASE_URL`; a service
 * whose only honest answer is an outage cannot show a screen rendering rows, and
 * rows are what Plan 02 exists to deliver. `e2e-live/seedRulebook.mjs` fills that
 * database from `packages/mocks`, and `migration-harness.yml` stands it up.
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

/**
 * ---------------------------------------------------------------------------
 * THE FROZEN SPECS THAT RUN AGAINST core-api, and the ones that cannot.
 * ---------------------------------------------------------------------------
 *
 * `apps/web-v2/e2e` IS NOT MODIFIED BY THIS AND MUST NEVER BE. The `live-frozen-
 * rulebook` project below points that directory at the live preview server and
 * selects a subset of it; a spec that needed an edit to pass would be a contract
 * mismatch or a product change, and either is a finding rather than a chore.
 *
 * 🔴 WHAT THIS PROJECT PROVES, AND WHAT IT DOES NOT.
 *
 * IT PROVES the frozen specs pass UNMODIFIED AGAINST THE LIVE BUILD. That is
 * Task 5's stated CONTRACT and it is worth having: a contract mismatch or a
 * product change would show up here as a spec that could not pass without being
 * edited, and that is a finding rather than a chore.
 *
 * IT PROVES NOTHING ABOUT core-api, POSTGRES, OR THE SWITCH, and two comments in
 * this repository used to say the opposite. MEASURED 2026-08-06, twice:
 *
 *   * point this project's `baseURL` at `MOCK_PORT` — one line, and precisely
 *     the "MSW left running" state Task 0 exists to catch — and all 7 PASS;
 *   * stop core-api entirely and 6 OF THE 7 STILL PASS. Only `authz` fails.
 *     A stub answering `{"rules":[]}` gives the same 6.
 *
 * So it is BREADTH. `e2e-live/reaches-core-api.spec.ts` is the only thing in
 * this directory that separates core-api from anything else that speaks JSON,
 * and it does it on the row ids — Postgres mints UUIDs, MSW answers `rule_r13`.
 *
 * FIVE FROZEN SPEC FILES NAVIGATE TO `/rulebook`, AND NONE IS A PURE
 * RULEBOOK-READ SPEC. Five, not six: an earlier version of this paragraph said
 * six and claimed to have measured it. `review-refusals.spec.ts` was the sixth,
 * and it NEVER GOES THERE — every `page.goto` in it is `/orders/{id}/review`,
 * and the two occurrences of the word "rulebook" are prose at `:17` and `:178`.
 * The count came from a grep and was then reported as a run. The exclusions
 * below are not "it failed"; each names what the test actually needs.
 *
 * ## Runs, and what each one is worth
 *
 *   authz.spec.ts   `the engineer gate's confirm affordance…` — the only one
 *                   that READS A RULE ROW. It opens the Pending filter, clicks
 *                   `rule-row-DRAFT-HOA-AGE` and drives the confirm affordance
 *                   across three roles, so it is the one test here that fails
 *                   when the rulebook is empty. It needs no migrated endpoint
 *                   beyond `GET /api/rules` because `canDo` is a CLIENT-side
 *                   table and `ActingAs` is a client-side preview control — the
 *                   screen asks the server for rules and for nothing else. It
 *                   still cannot tell core-api from MSW: both serve `demoRules`.
 *
 *   routes.spec.ts  `renders /rulebook` — no uncaught error, no not-found card.
 *   shell-frame     `the rail is a full-height column…` — navigates /rulebook
 *                   and measures the chrome around it.
 *   responsive      `the page never scrolls sideways at …px`, four widths.
 *                   `/rulebook` IS ONE OF FOUR ROUTES EACH WALKS, and the other
 *                   three — `/queue`, `/orders/ord_demo_1/review`,
 *                   `/completeness` (`responsive-frame.spec.ts:28`) — are
 *                   unmigrated. Under `live` each of these tests therefore
 *                   spends three quarters of its time asserting that ERROR
 *                   SCREENS do not scroll sideways. That is not worthless — the
 *                   shell is the same shell — but it is not what the title says.
 *
 * Those last six pass with the backend stopped, per the measurement above.
 *
 * ## Excluded, with the reason
 *
 *   authz.spec.ts:20,45   forge a role with `x-mock-role` and POST
 *   hard.spec.ts:20       `/api/engines/routing`, `/api/escalations/{id}/resolve`,
 *                         `/api/bugs`, `/api/me/permissions`. **core-api
 *                         implements no auth at all** — Plan 03 brings WorkOS,
 *                         and `api/routers/rules.py` says in its own docstring
 *                         that nothing here anticipates it — and none of those
 *                         four endpoints is migrated. `/rulebook` appears in
 *                         them only as a readiness gate.
 *   hard.spec.ts:46,67    `/orders/{id}/review` and the escalation resolve
 *                         endpoint. Unmigrated; not a rulebook test.
 *   review-refusals       every test navigates to `/orders/{id}/review`. The
 *                         file never reaches `/rulebook` at all.
 *   shell-frame:175       navigates to `/queue` and never reaches `/rulebook`.
 *                         (This entry previously blamed a 404 on
 *                         `/api/me/preferences`. The route is the real reason.)
 *   responsive:189        the masthead, measured on `/queue`. Unmigrated, and
 *                         `/rulebook` is not in it.
 */
const FROZEN_RULEBOOK_FILES = [
  /invariants\/authz\.spec\.ts$/,
  /invariants\/responsive-frame\.spec\.ts$/,
  /invariants\/shell-frame\.spec\.ts$/,
  /smoke\/routes\.spec\.ts$/,
];

/**
 * `testMatch` alone would drag in every OTHER test in those four files, so the
 * titles are named too. Spelled as anchored patterns rather than a loose
 * substring: `renders /rulebook` unanchored also matches nothing else today, and
 * would quietly widen the day a route is named `/rulebook-archive`.
 */
const FROZEN_RULEBOOK_TESTS = [
  /the engineer gate's confirm affordance exists only for its holders$/,
  /renders \/rulebook$/,
  /the rail is a full-height column, not a page-sticky element$/,
  /the page never scrolls sideways at \d+px$/,
];

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
    {
      /*
       * THE FROZEN SPECS, RUN LIVE — `apps/web-v2/e2e` pointed at core-api by
       * CONFIG ALONE, which is the sentence at the top of this file finally
       * cashed. Nothing in that directory is read differently, renamed or
       * touched; this project supplies a different `baseURL` and nothing else.
       *
       * BREADTH, NOT PROOF, and the block above the two lists below carries the
       * measurement: this project is 7 of 7 green against the MOCK bundle, and 6
       * of 7 green with core-api stopped. `live-reaches-core-api` is the only
       * project in this file that fails when the switch, the proxy or the build
       * is broken. What this one shows is that the frozen specs pass UNMODIFIED
       * against the live build — Task 5's contract, and a real one.
       *
       * Selection was made by RUNNING the frozen specs that navigate to
       * `/rulebook`, not by reading them. What runs is every frozen test that
       * exercises the rulebook screen and depends on no endpoint core-api has
       * not migrated; the exclusions are listed with what each one needs.
       */
      name: "live-frozen-rulebook",
      testDir: "./e2e",
      testMatch: FROZEN_RULEBOOK_FILES,
      grep: FROZEN_RULEBOOK_TESTS,
      use: { baseURL: `http://localhost:${LIVE_PORT}` },
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
