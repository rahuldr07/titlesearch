/*
 * HARVESTED INVARIANT SPECS — migrated by Pass 1 (2026-07-26).
 *
 * Every test here asserts a PRODUCT RULE, not the old UI's DOM. They were all
 * green immediately before migration (116/116). They are skipped, not deleted:
 * un-skip each one as the rebuilt feature reaches it, rewriting SELECTORS only.
 *
 * NEVER weaken an assertion to make it pass. If an invariant cannot pass
 * against the new design, that is a CONFLICT in the design — stop and report.
 *
 * Classification + the rule each protects: docs/frontend/test-harvest.md
 */

import { expect, test } from "@playwright/test";

/**
 * The hub at "/" — the map, live. Role-aware doors (absent, never dimmed),
 * each carrying its attention signal; amber is the only navigation signal.
 * Typists never reach it. Forbidden patterns stay out: no order counts
 * beyond the single next, no accuracy numbers, nothing throughput-shaped.
 */

// TODO(rebuild): un-skip when this feature lands — rule: the hub's doors are role-locked — absent, never dimmed
test("the hub's doors are role-locked — absent, never dimmed", async ({
  page,
}) => {
  await page.goto("/account");
  await page.getByRole("button", { name: "Me" }).click();
  await page.getByTestId("role-reviewer").click();
  // reach the hub by chord — a goto would reset the in-memory session
  await page.keyboard.press("g");
  await page.keyboard.press("h");
  await expect(page.getByTestId("home-hub")).toBeVisible();
  await expect(page.getByTestId("door-/queue")).toBeVisible();
  await expect(page.getByTestId("door-/dashboard")).toHaveCount(0);
  await expect(page.getByTestId("door-/bench")).toHaveCount(0);
  await expect(page.getByTestId("door-/leaderboard")).toHaveCount(0);
});

// TODO(rebuild): un-skip when this feature lands — rule: typists cannot chord to the hub
test("typists cannot chord to the hub", async ({ page }) => {
  await page.goto("/account");
  await page.getByRole("button", { name: "Me" }).click();
  await page.getByTestId("role-typist").click();
  await page.keyboard.press("g");
  await page.keyboard.press("h");
  await expect(page).toHaveURL(/\/account/);
});

// TODO(rebuild): un-skip when this feature lands — rule: nothing forbidden leaks onto the hub
test("nothing forbidden leaks onto the hub", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("home-hub")).toBeVisible();
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).not.toContain("throughput");
  expect(body).not.toContain("per hour");
  expect(body).not.toMatch(/accuracy\s*[:—-]?\s*\d/);
  expect(body).not.toMatch(/\d+\s+orders?\s+(waiting|in queue)/);
});
