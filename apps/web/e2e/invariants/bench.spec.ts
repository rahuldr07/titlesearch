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
 * Bench (§4.10/§4.11): section × tag matrix; ruled fails hot, suspect
 * annotated thin; no aggregate headline; no auto-tune affordance.
 */

// TODO(rebuild): un-skip when this feature lands — rule: results matrix renders section × tag with no aggregate headline
test("results matrix renders section × tag with no aggregate headline", async ({
  page,
}) => {
  await page.goto("/bench/results");
  await expect(page.getByTestId("cell-judgments_liens-suspect")).toContainText(
    "4f · 1/4",
  );
  await expect(page.getByTestId("cell-mortgages-ruled")).toContainText("5f");
  const body = (await page.locator("body").innerText()).toLowerCase();
  // no aggregate ACCURACY HEADLINE — prose mentions are fine, a big
  // whole-bench percentage is not
  expect(body).not.toMatch(/accuracy\s*[:—-]?\s*\d/);
  expect(body).not.toMatch(/9\d\.\d%/); // no 93.9%-style headline anywhere
  expect(body).toContain("no single number is");
});

// TODO(rebuild): un-skip when this feature lands — rule: a ruled fail is always actionable; a suspect fail doubts the seed
test("a ruled fail is always actionable; a suspect fail doubts the seed", async ({
  page,
}) => {
  await page.goto("/bench/results");
  await expect(page.getByTestId("fail-judgments_liens.1.type")).toContainText(
    "FAIL — ruled seed, always actionable",
  );
  await expect(
    page.getByTestId("fail-judgments_liens.1.attorney"),
  ).toContainText("may be the seed, not the model");
  // expanding a fail links into seed correction
  await page.getByTestId("fail-mortgages.1.amount").click();
  await expect(page.getByText("Investigate seed →")).toBeVisible();
});

// TODO(rebuild): un-skip when this feature lands — rule: bench has no auto-tune affordance and prompts come from the rulebook
test("bench has no auto-tune affordance and prompts come from the rulebook", async ({
  page,
}) => {
  await page.goto("/bench");
  await expect(page.getByTestId("rulecontext")).toContainText("R13");
  await expect(page.getByText("no auto-tune", { exact: false })).toBeVisible();
  const buttons = await page.getByRole("button").allInnerTexts();
  for (const b of buttons) {
    expect(b.toLowerCase()).not.toContain("tune");
    expect(b.toLowerCase()).not.toContain("optimize");
  }
});
