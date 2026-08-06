import { expect, test } from "@playwright/test";

/**
 * THE POSITIVE CONTROL. Everything else in this directory is a denial, and a
 * denial passes just as happily against an app that is simply broken.
 *
 * What is asserted is core-api's FINGERPRINT, arriving in the browser:
 *
 *   - the `NOT_FOUND` error envelope its exception handlers emit, and
 *   - the `x-request-id` its correlation middleware stamps on every response,
 *     carrying the same value the envelope reports.
 *
 * No other party in this system produces that pair. MSW's `GET /api/rules`
 * answers 200 with `{ rules: [...] }` and stamps no header; a proxy aimed at
 * nothing answers 500 from Vite with no envelope at all; a proxy that was never
 * configured gets the preview server's own 404, which is HTML. So this test
 * fails when the switch is removed, when the proxy is wrong, and when MSW is
 * left running — which is the only reason the other two tests mean anything.
 *
 * `/api/rules` is a 404 TODAY and that is expected: core-api serves no product
 * endpoint yet, and `/health` and `/ready` are deliberately not under `/api`
 * (see the module docstring of core-api's `api/routers/health.py`). The 404 is
 * being read as evidence of WHO answered, not of what it said. When the
 * endpoint lands, this assertion changes to the rows and stops being a control.
 */
test("core-api answers /api/rules in the browser, and MSW is not running", async ({
  page,
}) => {
  await page.goto("/rulebook");

  // The screen halts, because a 404 is not a rulebook. Asserted here as well as
  // in the denial spec so this test also covers "live mode never renders mocks"
  // with the backend genuinely reachable — the case a dead port cannot produce.
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

  expect(answer.status).toBe(404);
  expect(
    answer.requestId,
    "core-api stamps x-request-id on every response; nothing else here does",
  ).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

  // The header and the envelope must agree. A hand-written 404 could carry one
  // or the other; only the real middleware pair produces the same id in both.
  expect(answer.body).toMatchObject({
    error: { code: "NOT_FOUND", request_id: answer.requestId },
  });

  // And it is not the mock's shape, stated directly rather than implied by the
  // status — MSW could in principle be made to answer 404 too.
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
