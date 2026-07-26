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
 * UX-review fixes, pinned (2026-07-19 review): the workbench never
 * contradicts its own evidence, ⏎ never accepts a blank, refusals speak,
 * readings diff and adopt without retyping, and every screen has a mouse
 * path home.
 */

const go = async (page: import("@playwright/test").Page) => {
  await page.goto("/orders/ord_demo_1/review");
  await expect(page.getByTestId("sel-label")).toBeVisible();
};

// TODO(rebuild): un-skip when this feature lands — rule: a both-found disagreement never claims emptiness — draft leads, labeled
test.skip("a both-found disagreement never claims emptiness — draft leads, labeled", async ({
  page,
}) => {
  await go(page);
  await page.getByTestId("row-mortgages.1.lender").click();
  // the pill states the true situation…
  await expect(page.getByTestId("sel-state")).toHaveText(
    "ENGINES DISAGREE — NOTHING SETTLED",
  );
  // …the headline shows the draft AS a draft, not "Not Available"…
  await expect(page.getByText("draft — nothing settled yet")).toBeVisible();
  // …and nothing claims extraction returned nothing while readings show values
  await expect(
    page.getByText("extraction returned nothing at all"),
  ).toHaveCount(0);
});

// TODO(rebuild): un-skip when this feature lands — rule: differing characters between readings are highlighted
test.skip("differing characters between readings are highlighted", async ({
  page,
}) => {
  await go(page);
  await page.getByTestId("row-mortgages.1.lender").click();
  const marks = page.getByTestId("diff-hl");
  await expect(marks.first()).toBeVisible();
  expect(await marks.count()).toBeGreaterThan(0);
});

// TODO(rebuild): un-skip when this feature lands — rule: a reading can be adopted into the correction editor without retyping
test.skip("a reading can be adopted into the correction editor without retyping", async ({
  page,
}) => {
  await go(page);
  await page.getByTestId("row-mortgages.1.amount").click();
  await page.getByTestId(/^use-/).first().click();
  const value = page.getByTestId("edit-value");
  await expect(value).toBeVisible();
  // prefilled with the reading's exact value — no transcription
  await expect(value).toHaveValue(/^\$[\d,]+\.\d{2}$/);
  const reason = page.getByTestId("edit-reason");
  await reason.fill("words line is legible — matches this reading");
  await reason.press("Enter");
  await expect(
    page.getByTestId("row-mortgages.1.amount").getByTestId("row-mark"),
  ).toHaveText("✎ corrected");
});

// TODO(rebuild): un-skip when this feature lands — rule: ⏎ never accepts a blank — missing fields demand a click
test.skip("⏎ never accepts a blank — missing fields demand a click", async ({
  page,
}) => {
  await page.goto("/orders/ord_demo_1/review?field=mortgages.1.lender");
  await expect(page.getByTestId("sel-label")).toHaveText("MTG 1 — LENDER");
  await page.keyboard.press("Enter");
  // nothing happened: no mark, selection unmoved
  await expect(
    page.getByTestId("row-mortgages.1.lender").getByTestId("row-mark"),
  ).toHaveCount(0);
  await expect(page.getByTestId("sel-label")).toHaveText("MTG 1 — LENDER");
  // the explicit click still works
  await page.getByTestId("act-confirm").click();
  await expect(
    page.getByTestId("row-mortgages.1.lender").getByTestId("row-mark"),
  ).toHaveText("✓ accepted N/A");
});

// TODO(rebuild): un-skip when this feature lands — rule: refused submits SAY so — escalate, correct, pass all nudge
test.skip("refused submits SAY so — escalate, correct, pass all nudge", async ({
  page,
}) => {
  await go(page);
  // empty escalation
  await page.getByTestId("row-owner.zip").click();
  await page.keyboard.press("e");
  await page.getByTestId("escalate-input").press("Enter");
  await expect(page.getByTestId("nudge")).toContainText("needs its question");
  await page.keyboard.press("Escape");
  // correction without its why
  await page.keyboard.press("c");
  await page.getByTestId("edit-value").press("Enter");
  await expect(page.getByTestId("nudge")).toContainText(
    "both the value and its why",
  );
  await page.keyboard.press("Escape");
  // pass without a reason (review header popover)
  await page.keyboard.press("p");
  await page.locator("input:focus").press("Enter");
  await expect(page.getByTestId("nudge")).toContainText("a pass needs its why");
});

// TODO(rebuild): un-skip when this feature lands — rule: the queue's pass refusal nudges too
test.skip("the queue's pass refusal nudges too", async ({ page }) => {
  await page.goto("/queue");
  await expect(page.getByTestId("order-ref")).toBeVisible();
  await page.keyboard.press("p");
  await page.locator("input:focus").press("Enter");
  await expect(page.getByTestId("nudge")).toContainText("a pass needs its why");
});

