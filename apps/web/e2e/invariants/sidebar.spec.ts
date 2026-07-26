/*
 * HARVESTED INVARIANT SPECS — migrated by Pass 1 (2026-07-26).
 *
 * Every test here asserts a PRODUCT RULE, not the old UI's DOM. They were all
 * green immediately before migration (116/116).
 *
 * NEVER weaken an assertion to make it pass. If an invariant cannot pass
 * against the new design, that is a CONFLICT in the design — stop and report.
 *
 * Classification + the rule each protects: docs/frontend/test-harvest.md
 */

import { expect, test } from "@playwright/test";

/**
 * THE NAVIGATOR — rewritten 2026-07-27 for design-mock's chrome.
 *
 * design-mock has NO SIDEBAR. The navigator is a horizontal tab strip inside a
 * 60px header. The side rail, its keyboard fold, and its persisted collapse are
 * gone, and so is railStore.ts.
 *
 * SURVIVED, rewritten onto the header — selectors changed, assertions did not:
 *   - attention signals are DOTS, never counts
 *   - doors outside the role's world are ABSENT, not dimmed
 *   - the capture seat gets no chrome at all
 *
 * RETIRED — three specs governed an affordance that no longer exists, so there
 * is nothing left to assert. Recorded here rather than silently dropped; the
 * reasoning is in docs/frontend/decisions.md D4.
 *
 *   1. "[ folds the rail from the keyboard"
 *      No rail, no fold. The binding was REMOVED from GlobalKeys rather than
 *      left pointing at nothing — a key that swallows a keystroke and does
 *      nothing is the dead-keystroke defect O10 exists to prevent.
 *
 *   2. "[ inside a text field is text, not a fold"
 *      The RULE — typed text never triggers an action (orphan O15) — is intact
 *      and still enforced twice over: the typing guard in
 *      features/review/keys.ts, and hard.spec's "chord keys typed inside an
 *      input never navigate". Only this instance died with the `[` binding.
 *
 *   3. "collapse is a persisted UI preference"
 *      This was the single CONFLICT found in Pass 0: it asserted collapse
 *      survives a reload via localStorage, which the rebuild forbids outright
 *      (constraint 11 — nothing in browser storage). Deleting the rail resolves
 *      that conflict by removing the thing that needed persisting. The
 *      localStorage key is gone from the codebase entirely.
 */

// UN-SKIPPED 2026-07-27 (Pass 3). Rewritten onto the header nav; assertion intact
// and strengthened — no digit at all may survive in the navigator.
test("live attention dots ride the doors — red for a complaint, amber for a gap", async ({
  page,
}) => {
  await page.goto("/queue");
  await expect(page.getByTestId("app-header")).toBeVisible();
  // unresolved complaints are the hot-red act signal
  await expect(page.getByTestId("nav-dot-/complaints")).toBeVisible();
  // open escalations pull amber
  await expect(page.getByTestId("nav-dot-/escalations")).toBeVisible();
  // The navigator carries NO counts — dots only. A number in permanent chrome is
  // a backlog figure, which is a throughput counter wearing a different hat.
  const navText = await page.getByTestId("header-nav").innerText();
  expect(navText).not.toMatch(/\d+\s+unresolved/);
  expect(navText).not.toMatch(/\d+\s+open/);
  expect(navText).not.toMatch(/\d/);
});

// UN-SKIPPED 2026-07-27 (Pass 3). Rewritten onto the header nav; assertion intact.
test("doors outside the role's world are ABSENT, not dimmed", async ({
  page,
}) => {
  await page.goto("/account");
  await page.getByRole("button", { name: "Me" }).click();
  await page.getByTestId("role-reviewer").click();
  // the nav updates live on the role switch — no reload (which would reset it)
  await expect(page.getByTestId("nav-/queue")).toBeVisible();
  await expect(page.getByTestId("nav-/dashboard")).toHaveCount(0);
  await expect(page.getByTestId("nav-/bench")).toHaveCount(0);
  await expect(page.getByTestId("nav-/leaderboard")).toHaveCount(0);
});

// UN-SKIPPED 2026-07-27 (Pass 3). Assertion intact — this rule is about the
// SEAT, not the navigator, so it survives the redesign unchanged.
test("the capture seat has no chrome — structural blindness stays whole", async ({
  page,
}) => {
  await page.goto("/blind/ord_demo_1");
  await expect(page.getByTestId("blind-seat")).toBeVisible();
  // Not merely hidden — NOT MOUNTED. A header that renders live signals would
  // fire /api GETs from the capture seat and break the zero-GET floor that
  // blind-blindness.spec proves.
  await expect(page.getByTestId("app-header")).toHaveCount(0);
  await expect(page.getByTestId("header-nav")).toHaveCount(0);
});
