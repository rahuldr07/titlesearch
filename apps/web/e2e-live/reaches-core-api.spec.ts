import { expect, test } from "@playwright/test";

/**
 * The positive control. Everything else in this directory is a denial, and
 * a denial passes just as happily against an app that is simply broken —
 * this asserts core-api succeeding, in the browser, with the rows on
 * screen.
 *
 * The trap is that MSW serves the same rulebook: `demoRules` is what
 * `seedRulebook.mjs` seeds from, deliberately, so the frozen specs can name
 * `R13` and pass on either side. "R13 is on screen" therefore distinguishes
 * nothing; three things separate live from mock, none imitable:
 *
 *   `x-request-id`   stamped by core-api's correlation middleware on every
 *                    response, success included. MSW stamps nothing.
 *   the ids          `seedRulebook.mjs` writes no `id`; Postgres mints one
 *                    from `gen_random_uuid()`. MSW answers `rule_r13` and
 *                    friends — literal strings that match no UUID. The
 *                    load-bearing one: it survives somebody teaching MSW to
 *                    stamp a request id, and says the row came out of a
 *                    table.
 *   no worker        `VITE_API_MODE=live` registers none.
 */

/**
 * `demoRules`' four codes, as a literal rather than an import of the
 * fixture: importing it would make the seed and the assertion the same
 * statement. Sorted, because `db/rules.py::list_all` chooses the order and
 * this file is not the place to pin it.
 */
const SEEDED_CODES = ["DRAFT-HOA-AGE", "ESC-TAX-01", "R13", "R22"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test("core-api's rows reach the browser's rulebook, and MSW is not running", async ({
  page,
}) => {
  await page.goto("/rulebook");

  // The screen first: a wire assertion alone would pass against an app that
  // fetched correctly and rendered nothing. The book opens on LIVE, so R13
  // and R22 are the two visible rows; the pending draft is behind its own
  // filter and `authz.spec.ts` drives it.
  await expect(page.getByTestId("rule-row-R13")).toBeVisible();
  await expect(page.getByTestId("rule-row-R22")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);

  // In-page, not through Playwright's request context: a service worker
  // intercepts the browser's fetch and nothing else, so only a fetch the
  // page itself makes can show that no worker got there first.
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

  // The rows came out of Postgres. `seedRulebook.mjs` writes no `id` and
  // lets `gen_random_uuid()` mint one, precisely so this line can exist:
  // MSW's own answer carries `rule_r13` and friends, and no amount of
  // making the mock look like a server changes that without editing the
  // fixture the frozen specs depend on.
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
