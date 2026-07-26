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
 * Account layer (§4.16): Rulebook badges, PENDING visibly inert behind the
 * engineer gate; Audit read-only; role gating (§0.7) — reviewers never see
 * the dashboard.
 */

// TODO(rebuild): un-skip when this feature lands — rule: rulebook shows origin/status/jurisdiction badges; PENDING is inert
test.skip("rulebook shows origin/status/jurisdiction badges; PENDING is inert", async ({
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

// TODO(rebuild): un-skip when this feature lands — rule: the engineer gate confirms a pending rule into the live book
test.skip("the engineer gate confirms a pending rule into the live book", async ({
  page,
}) => {
  await page.goto("/account");
  await page.getByTestId("confirm-DRAFT-HOA-AGE").click();
  const rule = page.getByTestId("rule-DRAFT-HOA-AGE");
  await expect(rule).toContainText("LIVE");
  await expect(rule).toContainText("confirmed by eng_demo");
});

// TODO(rebuild): un-skip when this feature lands — rule: audit is a read-only append-only view
test.skip("audit is a read-only append-only view", async ({ page }) => {
  await page.goto("/account");
  await page.getByRole("button", { name: "Audit" }).click();
  await expect(page.getByText("golden_correction")).toBeVisible();
  await expect(page.getByText("engine_seat_change")).toBeVisible();
  // no write affordances: no inputs, no buttons beyond the tab bar + nav
  await expect(page.locator("input, textarea")).toHaveCount(0);
});

// TODO(rebuild): un-skip when this feature lands — rule: a reviewer never sees the dashboard (§0.7)
test.skip("a reviewer never sees the dashboard (§0.7)", async ({ page }) => {
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
