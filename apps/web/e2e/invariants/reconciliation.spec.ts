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
 * Reconciliation (§4.13): symmetric A/B; ruling REQUIRES a citation;
 * general rule offered never pre-selected, draft never pre-populated,
 * lands PENDING. Blind Fifty Status (§4.14): judgment gate vs ≥40;
 * no typist pace data.
 */

const PATH = "judgments_liens.1.type";

// TODO(rebuild): un-skip when this feature lands — rule: a ruling without a citation is refused
test.skip("a ruling without a citation is refused", async ({ page }) => {
  await page.goto("/reconciliation/ord_demo_1");
  await page.getByTestId(`pick-B-${PATH}`).click();
  const fieldBtn = page.getByTestId(`rule-field-${PATH}`);
  await expect(fieldBtn).toBeDisabled();
  await page
    .getByTestId(`cite-${PATH}`)
    .fill("FiFa search p 31 — NOTICE OF LIS PENDENS caption; R22");
  await expect(fieldBtn).toBeEnabled();
});

// TODO(rebuild): un-skip when this feature lands — rule: neither field-only nor general is pre-selected; the draft starts empty
test.skip("neither field-only nor general is pre-selected; the draft starts empty", async ({
  page,
}) => {
  await page.goto("/reconciliation/ord_demo_1");
  await page.getByTestId(`pick-B-${PATH}`).click();
  await page.getByTestId(`cite-${PATH}`).fill("FiFa p 31, caption — R22");
  // both choices sit side by side, nothing highlighted or pre-chosen
  await expect(page.getByTestId(`rule-field-${PATH}`)).toBeVisible();
  await expect(page.getByTestId(`rule-general-${PATH}`)).toBeVisible();
  await page.getByTestId(`rule-general-${PATH}`).click();
  await expect(page.getByTestId(`draft-${PATH}`)).toHaveValue("");
});

// TODO(rebuild): un-skip when this feature lands — rule: a general-rule ruling files the draft as PENDING
test.skip("a general-rule ruling files the draft as PENDING", async ({ page }) => {
  await page.goto("/reconciliation/ord_demo_1");
  await page.getByTestId(`pick-B-${PATH}`).click();
  await page.getByTestId(`cite-${PATH}`).fill("FiFa p 31, caption — R22");
  await page.getByTestId(`rule-general-${PATH}`).click();
  await page
    .getByTestId(`draft-${PATH}`)
    .fill("A lis pendens is a pending-suit notice, not a judgment — it reports under its own type.");
  await page.getByTestId(`file-draft-${PATH}`).click();
  const ruled = page.getByTestId(`ruled-${PATH}`);
  await expect(ruled).toContainText("✓ ruled");
  await expect(ruled).toContainText("RULEBOOK DRAFT — PENDING");
});

// TODO(rebuild): un-skip when this feature lands — rule: a third value needs its why; the model appears nowhere
test.skip("a third value needs its why; the model appears nowhere", async ({
  page,
}) => {
  await page.goto("/reconciliation/ord_demo_1");
  const path = "judgments_liens.1.amount";
  await page.getByTestId(`div-${path}`).getByText("both are wrong").click();
  await page.getByTestId(`third-val-${path}`).fill("$4,712.83");
  await page.getByTestId(`cite-${path}`).fill("writ body p 32 — words line");
  await expect(page.getByTestId(`rule-field-${path}`)).toBeDisabled(); // why missing
  await page
    .getByTestId(`third-why-${path}`)
    .fill("both misread the smudge; the words line is unambiguous");
  await page.getByTestId(`rule-field-${path}`).click();
  await expect(page.getByTestId(`ruled-${path}`)).toContainText("✓ ruled");
  const html = (await page.content()).toLowerCase();
  for (const s of ["gemini", "llmwhisperer", "model output", "reader a"]) {
    expect(html).not.toContain(s);
  }
});

// TODO(rebuild): un-skip when this feature lands — rule: status shows the judgment ≥40 gate and no typist pace data
test.skip("status shows the judgment ≥40 gate and no typist pace data", async ({
  page,
}) => {
  await page.goto("/blind-status");
  await expect(page.getByTestId("ready-count")).toHaveText("7");
  const cov = page.getByTestId("coverage-judgments_liens");
  await expect(cov).toContainText("6 of ≥40");
  await expect(cov).toContainText("the only gate left to judgment automation");
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).not.toMatch(/per hour|fields\/min|min\/field|\btimer\b/);
  expect(body).toContain("order level only");
});
