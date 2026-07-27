import { expect, test } from "@playwright/test";

/**
 * HARVESTED INVARIANTS — migrated from apps/web @ ade49af (pre-rebuild).
 * Source: apps/web/e2e/hard.spec.ts
 *
 * Every test here is SKIPPED until the feature it covers lands in web-v2.
 * Un-skip as each feature lands. Rewrite selectors freely.
 * NEVER weaken an assertion — if one cannot pass against the new design,
 * that is a CONFLICT in the design: stop and report (BRIEF §5 Phase 5).
 */

const ready = async (page: import("@playwright/test").Page) => {
  await page.goto("/account");
  // an MSW-served element proves the worker controls the page before we fetch
  await expect(page.getByTestId("rule-R13")).toBeVisible();
};
// TODO(rebuild) [INVARIANT] — rule: the role gate refuses a typist at every mutation (403) except the blind submit, where only the schema refuses (422).
test.skip("the typist role is refused at EVERY mutation except the blind submit", async ({
  page,
}) => {
  await ready(page);
  const results = await page.evaluate(async () => {
    const post = (path: string) =>
      fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json", "x-mock-role": "typist" },
        body: "{}",
      }).then((r) => r.status);
    const MUTATIONS = [
      "/api/orders",
      "/api/orders/x/accept",
      "/api/orders/x/pass",
      "/api/fields/x/confirm",
      "/api/fields/x/correct",
      "/api/fields/x/escalate",
      "/api/bugs",
      "/api/escalations/x/resolve",
      "/api/rules/x/confirm",
      "/api/golden/corrections",
      "/api/reconciliation/x",
      "/api/engines/routing",
      "/api/complaints",
      "/api/deliveries/x/retry",
    ];
    const refused: Record<string, number> = {};
    for (const path of MUTATIONS) refused[path] = await post(path);
    // the ONE open door: the role gate passes and only the SCHEMA refuses
    const blind = await post("/api/blind/x/entries");
    return { refused, blind };
  });
  for (const [path, status] of Object.entries(results.refused)) {
    expect(status, `typist must be 403 at ${path}`).toBe(403);
  }
  expect(results.blind).toBe(422);
});

// TODO(rebuild) [INVARIANT] — rule: a forged or case-variant role is refused — roles are exact, and garbage never yields the admin world.
test.skip("a forged role header is refused — mutations 403, the projection 400", async ({
  page,
}) => {
  await ready(page);
  const statuses = await page.evaluate(async () => ({
    mutation: await fetch("/api/bugs", {
      method: "POST",
      headers: { "content-type": "application/json", "x-mock-role": "superadmin" },
      body: "{}",
    }).then((r) => r.status),
    projection: await fetch("/api/me/permissions", {
      headers: { "x-mock-role": "superadmin" },
    }).then((r) => r.status),
    // roles are exact: a case variant is garbage, and garbage NEVER yields
    // the admin world
    caseVariant: await fetch("/api/me/permissions", {
      headers: { "x-mock-role": "Admin" },
    }).then((r) => r.status),
  }));
  expect(statuses.mutation).toBe(403);
  expect(statuses.projection).toBe(400);
  expect(statuses.caseVariant).toBe(400);
});

// TODO(rebuild) [INVARIANT] — rule: the blind submit response is key-exact: any extra key would be a channel INTO blindness.
test.skip("the blind submit response carries NOTHING beyond the ack (§0.6 at the wire)", async ({
  page,
}) => {
  await ready(page);
  const res = await page.evaluate(() =>
    fetch("/api/blind/ord_demo_1/entries", {
      method: "POST",
      headers: { "content-type": "application/json", "x-mock-role": "typist" },
      body: JSON.stringify({
        entries: [
          {
            path: "mortgages.1.lender",
            value: "SOUTHSTONE MORTGAGE LLC",
            na_reason: null,
            source_citation: "security deed 09812/44, p 3",
            confidence: "certain",
          },
        ],
      }),
    }).then(async (r) => ({ status: r.status, body: await r.json() })),
  );
  expect(res.status).toBe(200);
  // key-exact: any extra key here would be a channel INTO blindness
  expect(Object.keys(res.body as object).sort()).toEqual([
    "accepted",
    "entry_ids",
  ]);
});

// TODO(rebuild) [INVARIANT] — rule: a replayed resolution is refused (409) — resolution is not idempotent-repeatable.
test.skip("resolving the same escalation twice is refused the second time", async ({
  page,
}) => {
  await ready(page);
  const statuses = await page.evaluate(async () => {
    const resolve = () =>
      fetch("/api/escalations/esc_party_1/resolve", {
        method: "POST",
        headers: { "content-type": "application/json", "x-mock-role": "senior" },
        body: JSON.stringify({
          ruling: "ours when name + county match during our grantor's ownership",
          rule: { rule_id: "rule_r13" },
        }),
      }).then((r) => r.status);
    return { first: await resolve(), replay: await resolve() };
  });
  expect(statuses.first).toBe(200);
  expect(statuses.replay).toBe(409);
});

// TODO(rebuild) [INVARIANT] — rule: keys typed inside an input are TEXT, never chords. Typing a correction must never trigger navigation.
test.skip("chord keys typed inside an input never navigate", async ({ page }) => {
  await page.goto("/orders/ord_demo_1/review");
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
  await page.keyboard.press("e");
  const input = page.getByTestId("escalate-input");
  await expect(input).toBeFocused();
  // "g" then "d" inside the input is TEXT, not a chord to the readout
  await input.pressSequentially("gd");
  await expect(page).toHaveURL(/\/orders\/ord_demo_1\/review/);
  await expect(input).toHaveValue("gd");
  // and "?" inside the input is a question mark, not the map
  await input.pressSequentially("?");
  await expect(page.getByTestId("key-map")).toHaveCount(0);
  await expect(input).toHaveValue("gd?");
});

// TODO(rebuild) [INVARIANT] — rule: §0.3 — pending renders as 'not yet extracted', never as 'Not Available', on the complaint capture list too.
test.skip("the complaint capture list renders pending as 'not yet extracted' (§0.3)", async ({
  page,
}) => {
  await page.goto("/complaints");
  const row = page.getByTestId("cap-assessment.tax_status");
  await expect(row).toContainText("not yet extracted");
  await expect(row).not.toContainText("Not Available");
});
