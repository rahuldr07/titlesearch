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
 * The side rail — a persistent role-filtered navigator. It relaxes the
 * "no global menu" pattern (owner call) but keeps the laws it guarded:
 * role-locked doors are ABSENT not dimmed, the capture seat gets no rail at
 * all (structural blindness), and it shows attention DOTS, never counts.
 */

// TODO(rebuild): un-skip when this feature lands — rule: live attention dots ride the doors — red for a complaint, amber for a gap
test.skip("live attention dots ride the doors — red for a complaint, amber for a gap", async ({
  page,
}) => {
  await page.goto("/queue");
  await expect(page.getByTestId("side-rail")).toBeVisible();
  // unresolved complaints are the hot-red act signal
  await expect(page.getByTestId("rail-dot-/complaints")).toBeVisible();
  // open escalations pull amber
  await expect(page.getByTestId("rail-dot-/escalations")).toBeVisible();
  // the rail carries NO counts — dots only (numbers live on the hub)
  const railText = await page.getByTestId("side-rail").innerText();
  expect(railText).not.toMatch(/\d+\s+unresolved/);
  expect(railText).not.toMatch(/\d+\s+open/);
});

// TODO(rebuild): un-skip when this feature lands — rule: doors outside the role's world are ABSENT, not dimmed
test.skip("doors outside the role's world are ABSENT, not dimmed", async ({
  page,
}) => {
  await page.goto("/account");
  await page.getByRole("button", { name: "Me" }).click();
  await page.getByTestId("role-reviewer").click();
  // the rail updates live on the role switch — no reload (which would reset)
  await expect(page.getByTestId("rail-door-/queue")).toBeVisible();
  await expect(page.getByTestId("rail-door-/dashboard")).toHaveCount(0);
  await expect(page.getByTestId("rail-door-/bench")).toHaveCount(0);
  await expect(page.getByTestId("rail-door-/leaderboard")).toHaveCount(0);
});

// TODO(rebuild): un-skip when this feature lands — rule: the capture seat has no rail — structural blindness stays whole
test.skip("the capture seat has no rail — structural blindness stays whole", async ({
  page,
}) => {
  await page.goto("/blind/ord_demo_1");
  await expect(page.getByTestId("blind-seat")).toBeVisible();
  await expect(page.getByTestId("side-rail")).toHaveCount(0);
});

// TODO(rebuild): un-skip when this feature lands — rule: [ folds the rail from the keyboard
test.skip("[ folds the rail from the keyboard", async ({ page }) => {
  await page.goto("/queue");
  const rail = page.getByTestId("side-rail");
  await expect(rail).toHaveAttribute("data-collapsed", "0");
  await page.keyboard.press("[");
  await expect(rail).toHaveAttribute("data-collapsed", "1");
  await page.keyboard.press("[");
  await expect(rail).toHaveAttribute("data-collapsed", "0");
});

// TODO(rebuild): un-skip when this feature lands — rule: [ inside a text field is text, not a fold
test.skip("[ inside a text field is text, not a fold", async ({ page }) => {
  await page.goto("/orders/ord_demo_1/review?field=owner.zip");
  await expect(page.getByTestId("sel-label")).toBeVisible();
  await page.keyboard.press("c");
  const editor = page.getByTestId("edit-value");
  await editor.click();
  await editor.fill("");
  await editor.press("[");
  // the bracket lands in the field; the rail does not move
  await expect(editor).toHaveValue("[");
  await expect(page.getByTestId("side-rail")).toHaveAttribute(
    "data-collapsed",
    "0",
  );
});

// TODO(rebuild): un-skip when this feature lands — rule: collapse is a persisted UI preference
test.skip("collapse is a persisted UI preference", async ({ page }) => {
  await page.goto("/queue");
  const rail = page.getByTestId("side-rail");
  await expect(rail).toHaveAttribute("data-collapsed", "0");
  await page.getByTestId("rail-toggle").click();
  await expect(rail).toHaveAttribute("data-collapsed", "1");
  // labels collapse away; the chord key and dots remain
  await expect(page.getByTestId("rail-door-/queue")).toBeVisible();
  // survives a reload (localStorage, not session)
  await page.reload();
  await expect(page.getByTestId("side-rail")).toHaveAttribute(
    "data-collapsed",
    "1",
  );
  // and can be expanded again — never a one-way trap
  await page.getByTestId("rail-toggle").click();
  await expect(page.getByTestId("side-rail")).toHaveAttribute(
    "data-collapsed",
    "0",
  );
});
