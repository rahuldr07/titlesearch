import { expect, test } from "@playwright/test";

/**
 * Never weaken an assertion — a test that cannot pass against the new
 * design is a conflict in the design: stop and report.
 */

const ready = async (page: import("@playwright/test").Page) => {
  await page.goto("/escalations");
  // an MSW-served element proves the worker controls the page before we fetch
  await expect(page.getByTestId("escalation-esc_party_1")).toBeVisible();
};

// Rule: a forged or case-variant role is refused — roles are exact, and garbage never yields the admin world.
test("a forged role header is refused — mutations 403, the projection 400", async ({
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

// Rule: a replayed resolution is refused (409) — resolution is not idempotent-repeatable.
test("resolving the same escalation twice is refused the second time", async ({
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

// Rule: keys typed inside an input are TEXT, never chords. Typing a correction must never trigger navigation.
test("chord keys typed inside an input never navigate", async ({ page }) => {
  await page.goto("/orders/ord_demo_1/review");
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
  // `e` opens the correction editor (C confirm · E correct); its field is the
  // input a reviewer types into.
  await page.keyboard.press("e");
  const input = page.getByTestId("edit-value");
  await expect(input).toBeFocused();
  await input.fill("");
  // "g" then "d" inside the input is TEXT, not a chord to the readout
  await input.pressSequentially("gd");
  await expect(page).toHaveURL(/\/orders\/ord_demo_1\/review/);
  await expect(input).toHaveValue("gd");
  // and "?" inside the input is a question mark, not the map
  await input.pressSequentially("?");
  await expect(page.getByTestId("key-map")).toHaveCount(0);
  await expect(input).toHaveValue("gd?");
});
