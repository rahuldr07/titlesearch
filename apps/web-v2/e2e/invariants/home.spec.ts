import { expect, test } from "@playwright/test";

/**
 * SELECTOR REWRITE 2026-07-28: the account tabs are getByRole("tab"), not
 * ("button"). Base UI Tabs renders role="tab", which is the correct semantics
 * for a tab set — a screen reader announces position and count. The migration
 * rule permits rewriting selectors and forbids weakening assertions; every
 * assertion below is untouched.
 *
 * HARVESTED INVARIANTS — migrated from apps/web @ ade49af (pre-rebuild).
 * Source: apps/web/e2e/home.spec.ts
 *
 * Every test here is SKIPPED until the feature it covers lands in web-v2.
 * Un-skip as each feature lands. Rewrite selectors freely.
 * NEVER weaken an assertion — if one cannot pass against the new design,
 * that is a CONFLICT in the design: stop and report (BRIEF §5 Phase 5).
 */

// DROPPED — STRUCTURAL — hub door copy and layout of the old design.
// was: / renders the hub with live attention signals
// TODO(rebuild) [INVARIANT] — rule: hub doors are role-locked — ABSENT, never dimmed.
test("the hub's doors are role-locked — absent, never dimmed", async ({
  page,
}) => {
  await page.goto("/account");
  await page.getByRole("tab", { name: "Me" }).click();
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

// TODO(rebuild) [INVARIANT] — rule: Enter on the hub opens the role's FIRST door,
// so the keyboard default action is the one the server ranked first. RESTORED
// 2026-07-27: the `g h` half is incidentally covered elsewhere, but the Enter
// assertion existed in no migrated spec — no other test presses Enter on the hub.
test("g h jumps home from anywhere; ⏎ opens the role's first door", async ({ page }) => {
  await page.goto("/queue");
  await expect(page.getByTestId("order-ref")).toBeVisible();
  await page.keyboard.press("g");
  await page.keyboard.press("h");
  await expect(page.getByTestId("home-hub")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/queue/);
});
// TODO(rebuild) [INVARIANT] — rule: a typist cannot reach the hub at all — the capture seat is a sealed world.
test("typists cannot chord to the hub", async ({ page }) => {
  await page.goto("/account");
  await page.getByRole("tab", { name: "Me" }).click();
  await page.getByTestId("role-typist").click();
  await page.keyboard.press("g");
  await page.keyboard.press("h");
  await expect(page).toHaveURL(/\/account/);
});

// TODO(rebuild) [INVARIANT] — rule: no throughput, no pace, no accuracy figure and no backlog COUNT leaks onto the hub.
test("nothing forbidden leaks onto the hub", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("home-hub")).toBeVisible();
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).not.toContain("throughput");
  expect(body).not.toContain("per hour");
  expect(body).not.toMatch(/accuracy\s*[:—-]?\s*\d/);
  expect(body).not.toMatch(/\d+\s+orders?\s+(waiting|in queue)/);
});
