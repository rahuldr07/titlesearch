import { expect, test } from "@playwright/test";

/**
 * THE POSITIVE CONTROL. Everything else in this directory is a denial, and a
 * denial passes just as happily against an app that is simply broken.
 *
 * ---------------------------------------------------------------------------
 * 🔴 THE 404 ERA ENDED, THEN THE 503 ERA ENDED. Both are recorded because the
 *    shape of the correction repeated.
 *
 *    This file first asserted `404` / `NOT_FOUND` and explained that core-api
 *    "serves no product endpoint yet". Task 4 landed `GET /api/rules` and it
 *    failed with `Expected: 404 / Received: 503`. It was rewritten to assert
 *    `DEPENDENCY_UNAVAILABLE`, and said in its own words that whether the
 *    harness gains a database "is Task 5's decision, not this file's", and that
 *    the day it did, "rows would arrive and `rules` would be present" — which is
 *    exactly what fails first.
 *
 *    TASK 5 DECIDED: THE HARNESS GETS A DATABASE. `migration-harness.yml` now
 *    stands up Postgres, migrates it and seeds the rulebook from
 *    `packages/mocks`, because the deliverable of Plan 02 is a real screen
 *    rendering real rows and there is no way to show that against a service
 *    whose only honest answer is an outage.
 * ---------------------------------------------------------------------------
 *
 * ## What is asserted now, and why it is the strongest of the three
 *
 * The 404 was evidence about WHO answered. The 503 added that the endpoint under
 * migration is the one that answered — but it was still core-api FAILING, and a
 * failure is a thin thing to certify a migration on. This asserts core-api
 * SUCCEEDING, in the browser, with the rows on screen.
 *
 * The trap that creates is that MSW serves the same rulebook: `demoRules` is
 * what `e2e-live/seedRulebook.mjs` seeds FROM, deliberately, so the frozen specs
 * in `apps/web-v2/e2e` can name `R13` and pass on either side. So "R13 is on
 * screen" no longer distinguishes live from mock at all, and this file cannot
 * rest on it. THREE THINGS SEPARATE THEM, and none is imitable by the mock:
 *
 *   `x-request-id`   stamped by core-api's correlation middleware on EVERY
 *                    response, success included — verified against the 200 here,
 *                    not assumed from the error path. MSW stamps nothing.
 *   the ids          `seedRulebook.mjs` writes no `id`; Postgres mints one from
 *                    `gen_random_uuid()`. MSW answers `rule_r13`, `rule_r22`,
 *                    `rule_tax_vintage`, `rule_draft_hoa` — literal strings that
 *                    match no UUID. THIS IS THE LOAD-BEARING ONE: it is the only
 *                    assertion here that survives somebody teaching MSW to stamp
 *                    a request id, and it says the row came out of a table.
 *   no worker        `VITE_API_MODE=live` registers none.
 *
 * Measured against a core-api booted from this tree with the seeded database:
 *
 *   HTTP/1.1 200 OK
 *   x-request-id: 711d98a8-21b5-4ca2-b7e2-92b6d72684da
 *   {"rules":[{"id":"71923834-329b-4275-9d32-58e20102f890","code":"DRAFT-HOA-AGE",…
 */

/**
 * `demoRules`' four codes, and this is a LITERAL rather than an import of the
 * fixture. Importing it would make the seed and the assertion the same
 * statement, so a seed that wrote the wrong table, wrote nothing, or wrote rows
 * the endpoint then dropped would agree with itself. Written out, the list is an
 * independent claim about what must arrive.
 *
 * Sorted, because `db/rules.py::list_all` chooses the order and this file is not
 * the place to pin it — `services/core-api/tests/test_rule_repository.py` is.
 */
const SEEDED_CODES = ["DRAFT-HOA-AGE", "ESC-TAX-01", "R13", "R22"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test("core-api's rows reach the browser's rulebook, and MSW is not running", async ({
  page,
}) => {
  await page.goto("/rulebook");

  // THE SCREEN, FIRST. A wire assertion alone would pass against an app that
  // fetched correctly and rendered nothing, which is the failure this whole plan
  // is about. The book opens on LIVE, so R13 and R22 are the two visible rows;
  // the pending draft is behind its own filter and `authz.spec.ts` drives it.
  await expect(page.getByTestId("rule-row-R13")).toBeVisible();
  await expect(page.getByTestId("rule-row-R22")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);

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
      body: (await response.json()) as { rules?: { id: string; code: string }[] },
    };
  });

  expect(answer.status).toBe(200);
  expect(
    answer.requestId,
    "core-api stamps x-request-id on every response, success included; nothing else here does",
  ).toMatch(UUID);

  const rules = answer.body.rules ?? [];
  expect([...rules.map((rule) => rule.code)].sort()).toEqual(SEEDED_CODES);

  // 🔴 THE ROWS CAME OUT OF POSTGRES. `seedRulebook.mjs` writes no `id` and lets
  // `gen_random_uuid()` mint one, precisely so this line can exist: MSW's own
  // answer to the same request carries `rule_r13` and friends, and no amount of
  // making the mock look like a server changes that without editing the fixture
  // the frozen specs depend on.
  for (const rule of rules) {
    expect(
      rule.id,
      `${rule.code} arrived with id ${rule.id} — MSW's spelling, not a database's`,
    ).toMatch(UUID);
  }

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
