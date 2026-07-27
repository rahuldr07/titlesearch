import { expect, test } from "@playwright/test";

/**
 * SELECTOR REWRITE 2026-07-28: the account tabs are getByRole("tab"), not
 * ("button"). Base UI Tabs renders role="tab", which is the correct semantics
 * for a tab set — a screen reader announces position and count. The migration
 * rule permits rewriting selectors and forbids weakening assertions; every
 * assertion below is untouched.
 *
 * HARVESTED INVARIANTS — migrated from apps/web @ ade49af (pre-rebuild).
 * Source: apps/web/e2e/account.spec.ts
 *
 * Every test here is SKIPPED until the feature it covers lands in web-v2.
 * Un-skip as each feature lands. Rewrite selectors freely.
 * NEVER weaken an assertion — if one cannot pass against the new design,
 * that is a CONFLICT in the design: stop and report (BRIEF §5 Phase 5).
 */

// TODO(rebuild) [INVARIANT] — rule: every rule carries origin, status and jurisdiction; PENDING renders as visibly unable to affect the pipeline.
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

// TODO(rebuild) [INVARIANT] — rule: only the engineer gate promotes PENDING into the live book, and it records who confirmed.
test("the engineer gate confirms a pending rule into the live book", async ({
  page,
}) => {
  await page.goto("/account");
  await page.getByTestId("confirm-DRAFT-HOA-AGE").click();
  const rule = page.getByTestId("rule-DRAFT-HOA-AGE");
  await expect(rule).toContainText("LIVE");
  await expect(rule).toContainText("confirmed by eng_demo");
});

// TODO(rebuild) [INVARIANT] — rule: audit is read-only and append-only — no write affordances exist on it.
test("audit is a read-only append-only view", async ({ page }) => {
  await page.goto("/account");
  await page.getByRole("tab", { name: "Audit" }).click();
  await expect(page.getByText("golden_correction")).toBeVisible();
  await expect(page.getByText("engine_seat_change")).toBeVisible();
  // no write affordances: no inputs, no buttons beyond the tab bar + nav
  await expect(page.locator("input, textarea")).toHaveCount(0);
});

// TODO(rebuild) [INVARIANT] — rule: §0.7 — role-locked entry is structural: the door is ABSENT and the chord refuses the jump.
test("a reviewer never sees the dashboard (§0.7)", async ({ page }) => {
  await page.goto("/account");
  await page.getByRole("tab", { name: "Me" }).click();
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
