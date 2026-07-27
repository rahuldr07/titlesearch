import { expect, test } from "@playwright/test";

/**
 * HARVESTED INVARIANTS — migrated from apps/web @ ade49af (pre-rebuild).
 * Source: apps/web/e2e/reconciliation.spec.ts
 *
 * Every test here is SKIPPED until the feature it covers lands in web-v2.
 * Un-skip as each feature lands. Rewrite selectors freely.
 * NEVER weaken an assertion — if one cannot pass against the new design,
 * that is a CONFLICT in the design: stop and report (BRIEF §5 Phase 5).
 */

const PATH = "judgments_liens.1.type";
// TODO(rebuild) [INVARIANT] — rule: §4.13 — a ruling is refused without a citation.
test("a ruling without a citation is refused", async ({ page }) => {
  await page.goto("/reconciliation/ord_demo_1");
  await page.getByTestId(`pick-B-${PATH}`).click();
  const fieldBtn = page.getByTestId(`rule-field-${PATH}`);
  await expect(fieldBtn).toBeDisabled();
  await page
    .getByTestId(`cite-${PATH}`)
    .fill("FiFa search p 31 — NOTICE OF LIS PENDENS caption; R22");
  await expect(fieldBtn).toBeEnabled();
});

// TODO(rebuild) [INVARIANT] — rule: neither rule scope is pre-selected and the draft never starts pre-populated — the choice is the human's.
test("neither field-only nor general is pre-selected; the draft starts empty", async ({
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

// TODO(rebuild) [INVARIANT] — rule: a general-rule ruling files its draft as PENDING.
test("a general-rule ruling files the draft as PENDING", async ({ page }) => {
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

// TODO(rebuild) [INVARIANT] — rule: a third value needs its why, and the engine identities appear nowhere on the screen.
test("a third value needs its why; the model appears nowhere", async ({
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

// TODO(rebuild) [INVARIANT] — rule: §4.14 — coverage is shown against the ≥40 judgment gate, at order level only, with no typist pace data.
test("status shows the judgment ≥40 gate and no typist pace data", async ({
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
