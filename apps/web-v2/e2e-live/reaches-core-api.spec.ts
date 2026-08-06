import { expect, test } from "@playwright/test";

/**
 * THE POSITIVE CONTROL. Everything else in this directory is a denial, and a
 * denial passes just as happily against an app that is simply broken.
 *
 * What is asserted is core-api's FINGERPRINT, arriving in the browser:
 *
 *   - the error envelope its exception handlers emit, carrying a STABLE `code`,
 *     and
 *   - the `x-request-id` its correlation middleware stamps on every response,
 *     holding the same value the envelope reports.
 *
 * No other party in this system produces that pair. MSW's `GET /api/rules`
 * answers 200 with `{ rules: [...] }` and stamps no header; a proxy aimed at
 * nothing answers 500 from Vite with no envelope at all; a proxy that was never
 * configured gets the preview server's own 404, which is HTML. So this test
 * fails when the switch is removed, when the proxy is wrong, and when MSW is
 * left running — which is the only reason the other two tests mean anything.
 *
 * ---------------------------------------------------------------------------
 * 🔴 THE 404 ERA ENDED. This asserted `404` / `NOT_FOUND` and explained that
 *    "`/api/rules` is a 404 TODAY… core-api serves no product endpoint yet",
 *    adding that "when the endpoint lands, this assertion changes to the rows
 *    and stops being a control." The endpoint landed — Plan 02 Task 4 — and this
 *    file failed on exactly that line, `Expected: 404 / Received: 503`.
 * ---------------------------------------------------------------------------
 *
 * IT DID NOT STOP BEING A CONTROL, AND THE NEW FINGERPRINT IS STRONGER THAN THE
 * OLD ONE. A 404 is what any HTTP server on earth answers for a path it does not
 * have, so the old assertion leaned entirely on the envelope and the header
 * beside it. `DEPENDENCY_UNAVAILABLE` is a code only this service's own
 * `DOMAIN_ERROR_STATUS` produces, and it is reached by core-api actually
 * attempting the read and failing — a route that exists, a handler that ran.
 * The 404 was evidence about WHO answered; this is evidence about who answered
 * AND that the endpoint under migration is the one that answered.
 *
 * WHY 503 AND NOT THE ROWS: THE HARNESS HAS NO DATABASE, ON PURPOSE.
 * `migration-harness.yml` boots core-api on `TITLEPIPE_ENVIRONMENT=development`
 * alone and says so in its own comment — "NO DATABASE… standing up Postgres here
 * would be scope this job does not need." Under Task 4 that is no longer a gap
 * in the endpoint, it is the endpoint working: `app_database_url` is unset, so
 * `api/routers/rules.py` raises `DependencyUnavailableError` and `api/errors.py`
 * renders the envelope below. **Whether this harness gains a database so the
 * screen can render real rows is Task 5's decision, not this file's.** Do not
 * add one here, and do not read the 503 as something to fix.
 *
 * Measured against a core-api booted from this tree with no database:
 *
 *   HTTP/1.1 503 Service Unavailable
 *   x-request-id: 0cc23a8b-620b-4b61-95c7-961604a83ebb
 *   {"error":{"code":"DEPENDENCY_UNAVAILABLE","message":"The rulebook is
 *    temporarily unavailable. Try again shortly.","request_id":"0cc23a8b-…",
 *    "details":{}}}
 */
test("core-api answers /api/rules in the browser, and MSW is not running", async ({
  page,
}) => {
  await page.goto("/rulebook");

  // The screen halts, because a 503 is not a rulebook. Asserted here as well as
  // in the denial spec so this test also covers "live mode never renders mocks"
  // with the backend genuinely reachable — the case a dead port cannot produce.
  //
  // NOTE that this half no longer DISTINGUISHES this test from
  // `halts-without-core-api.spec.ts`: an unreachable core-api and a reachable one
  // with no database now paint the same screen. That was already true of the old
  // 404 and is why that spec's own docstring says it "proves very little" alone.
  // Everything below is what separates them.
  await expect(page.getByRole("alert")).toHaveText("Rulebook unavailable.");
  await expect(page.getByTestId("rule-row-R13")).toHaveCount(0);

  // IN-PAGE, not through Playwright's request context. A service worker
  // intercepts the browser's fetch and nothing else, so only a fetch the page
  // itself makes can show that no worker got there first.
  const answer = await page.evaluate(async () => {
    const response = await fetch("/api/rules", {
      headers: { accept: "application/json" },
    });
    return {
      status: response.status,
      requestId: response.headers.get("x-request-id"),
      body: (await response.json()) as unknown,
    };
  });

  expect(answer.status).toBe(503);
  expect(
    answer.requestId,
    "core-api stamps x-request-id on every response; nothing else here does",
  ).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

  // The header and the envelope must agree. A hand-written 503 could carry one
  // or the other; only the real middleware pair produces the same id in both.
  //
  // `DEPENDENCY_UNAVAILABLE` is asserted by name rather than accepting any code:
  // the whole point of the envelope is that `code` is stable and machine-
  // readable, and a test that took whatever code arrived would pass against a
  // route answering `INTERNAL_ERROR` — which is what a bare `HTTPException` in
  // the handler produces, and is a real defect this file should catch.
  expect(answer.body).toMatchObject({
    error: { code: "DEPENDENCY_UNAVAILABLE", request_id: answer.requestId },
  });

  // And it is not the mock's shape, stated directly rather than implied by the
  // status — MSW could in principle be made to answer 503 too. This is also what
  // fails first on the day the harness DOES get a database and nobody updates
  // this file: rows would arrive and `rules` would be present.
  expect(answer.body).not.toHaveProperty("rules");

  // The contract's own words: `live` starts no worker. This is a check ON a
  // guard rather than the guard itself — `main.tsx` now REFUSES to boot when it
  // finds a registration, and `refuses-stale-worker.spec.ts` proves that. What
  // this line adds is that the clean path really is clean, so the refusal being
  // absent above means "no worker" and not "the guard is broken".
  const workers = await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    return registrations.length;
  });
  expect(workers, "VITE_API_MODE=live must register no service worker").toBe(0);
});
