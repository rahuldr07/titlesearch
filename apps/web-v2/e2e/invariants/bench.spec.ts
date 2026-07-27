import { expect, test } from "@playwright/test";

/**
 * HARVESTED INVARIANTS — migrated from apps/web @ ade49af (pre-rebuild).
 * Source: apps/web/e2e/bench.spec.ts
 *
 * Every test here is SKIPPED until the feature it covers lands in web-v2.
 * Un-skip as each feature lands. Rewrite selectors freely.
 * NEVER weaken an assertion — if one cannot pass against the new design,
 * that is a CONFLICT in the design: stop and report (BRIEF §5 Phase 5).
 */

// TODO(rebuild) [INVARIANT] — rule: §4.10 — results render as a section × tag matrix with NO aggregate accuracy headline.
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

// TODO(rebuild) [INVARIANT] — rule: a ruled-seed fail is always actionable; a suspect-seed fail may be the seed, not the model.
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

// TODO(rebuild) [INVARIANT] — rule: §4.11 — no auto-tune or optimize affordance exists, and prompts come from the rulebook.
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
