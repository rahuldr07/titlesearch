import { expect, test } from "@playwright/test";

/**
 * Account layer (§4.16): Rulebook badges, PENDING visibly inert behind the
 * engineer gate; Audit read-only; role gating (§0.7) — reviewers never see
 * the dashboard.
 */

test("rulebook shows origin/status/jurisdiction badges; PENDING is inert", async ({
  page,
}) => {
  await page.goto("/account");
  const live = page.getByTestId("rule-R13");
  await expect(live).toContainText("senior");
  await expect(live).toContainText("LIVE");
  const draft = page.getByTestId("rule-DRAFT-HOA-AGE");
  await expect(draft).toContainText("PENDING — CANNOT AFFECT THE PIPELINE");
  await expect(draft).toContainText("escalation");
  await expect(draft).toContainText("GA"); // jurisdiction scope badge
});

test("the engineer gate confirms a pending rule into the live book", async ({
  page,
}) => {
  await page.goto("/account");
  await page.getByTestId("confirm-DRAFT-HOA-AGE").click();
  const rule = page.getByTestId("rule-DRAFT-HOA-AGE");
  await expect(rule).toContainText("LIVE");
  await expect(rule).toContainText("confirmed by eng_demo");
});

test("audit is a read-only append-only view", async ({ page }) => {
  await page.goto("/account");
  await page.getByRole("button", { name: "Audit" }).click();
  await expect(page.getByText("golden_correction")).toBeVisible();
  await expect(page.getByText("engine_seat_change")).toBeVisible();
  // no write affordances: no inputs, no buttons beyond the tab bar + nav
  await expect(page.locator("input, textarea")).toHaveCount(0);
});

test("a reviewer never sees the dashboard (§0.7)", async ({ page }) => {
  await page.goto("/account");
  await page.getByRole("button", { name: "Me" }).click();
  await page.getByTestId("role-reviewer").click();
  // Role-locked entry is structural: the link isn't dimmed, it's ABSENT —
  // the door doesn't exist in the reviewer's world (nav.ts).
  await expect(page.getByRole("link", { name: "Readout" })).toHaveCount(0);
  // and the g-d chord refuses the jump: still on /account
  await page.keyboard.press("g");
  await page.keyboard.press("d");
  await expect(page).toHaveURL(/\/account/);
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).not.toContain("catch rate");
  expect(body).not.toContain("backlog");
});
