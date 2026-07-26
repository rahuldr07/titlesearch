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
 * Review refusals + invariants (frontend-master-prompt §0.4/§0.5, §4.2).
 * MSW state is per page load, so each test starts clean.
 */

const go = async (page: import("@playwright/test").Page) => {
  await page.goto("/orders/ord_demo_1/review");
  await expect(page.getByTestId("sel-label")).toBeVisible();
};

// TODO(rebuild): un-skip when this feature lands — rule: both NA states + pending render distinctly
test.skip("both NA states + pending render distinctly", async ({ page }) => {
  await go(page);
  // NOT_PRESENT — quiet, chip says expected
  const plat = page.getByTestId("row-legal.plat_book_page");
  await expect(plat).toContainText("Not Available");
  await expect(plat).toContainText("N/A — EXPECTED");
  // PRESENT_UNREADABLE — surfaced for attention
  const caseNo = page.getByTestId("row-judgments.1.case_no");
  await expect(caseNo).toContainText("Not Available");
  await expect(caseNo).toContainText("PRESENT — UNREADABLE");
  // pending — a third, distinct render; never "Not Available"
  const pending = page.getByTestId("row-assessment.tax_status");
  await expect(pending).toContainText("not yet extracted");
  await expect(pending).not.toContainText("Not Available");
});

// TODO(rebuild): un-skip when this feature lands — rule: a confirmed value without provenance renders visibly flagged
test.skip("a confirmed value without provenance renders visibly flagged", async ({
  page,
}) => {
  await go(page);
  await expect(page.getByTestId("row-judgments.1.amount")).toContainText(
    "NO PROVENANCE",
  );
});

// TODO(rebuild): un-skip when this feature lands — rule: A≠B disagreement leads: chip on the row, both readings in the panel
test.skip("A≠B disagreement leads: chip on the row, both readings in the panel", async ({
  page,
}) => {
  await go(page);
  const lender = page.getByTestId("row-mortgages.1.lender");
  await expect(lender).toContainText("A≠B");
  await lender.click();
  await expect(page.getByText("THEY DISAGREE. THAT IS WHY IT IS YOURS.")).toBeVisible();
  await expect(page.getByText("gemini-2.5-flash").first()).toBeVisible();
  await expect(page.getByText("llmwhisperer-hq").first()).toBeVisible();
});

// TODO(rebuild): un-skip when this feature lands — rule: correction without a reason never submits
test.skip("correction without a reason never submits", async ({ page }) => {
  await go(page);
  await page.getByTestId("row-mortgages.1.lender").click();
  await page.keyboard.press("c");
  const value = page.getByTestId("edit-value");
  await expect(value).toBeFocused();
  // value present (seeded from Reader A), reason empty → Enter must do nothing
  await value.press("Enter");
  await expect(page.getByTestId("edit-reason")).toBeVisible();
  await expect(
    page.getByTestId("row-mortgages.1.lender").getByTestId("row-mark"),
  ).toHaveCount(0);
});

// TODO(rebuild): un-skip when this feature lands — rule: correction with value + reason submits and renders the server's state
test.skip("correction with value + reason submits and renders the server's state", async ({
  page,
}) => {
  await go(page);
  await page.getByTestId("row-mortgages.1.lender").click();
  await page.keyboard.press("c");
  await page.getByTestId("edit-value").fill("SOUTHSTONE MORTGAGE LLC");
  const reason = page.getByTestId("edit-reason");
  await reason.fill("page reads SOUTHSTONE; B's zeros are the OCR failure mode");
  await reason.press("Enter");
  await expect(
    page.getByTestId("row-mortgages.1.lender").getByTestId("row-mark"),
  ).toHaveText("✎ corrected");
});

// TODO(rebuild): un-skip when this feature lands — rule: escalation without a question never submits
test.skip("escalation without a question never submits", async ({ page }) => {
  await go(page);
  await page.getByTestId("row-owner.zip").click();
  await page.keyboard.press("e");
  const input = page.getByTestId("escalate-input");
  await expect(input).toBeFocused();
  await input.press("Enter");
  await expect(input).toBeVisible(); // still open, nothing sent
  await expect(
    page.getByTestId("row-owner.zip").getByTestId("row-mark"),
  ).toHaveCount(0);
});

// TODO(rebuild): un-skip when this feature lands — rule: escalation with a question records; confirm via ⏎ records
test.skip("escalation with a question records; confirm via ⏎ records", async ({
  page,
}) => {
  await go(page);
  await page.getByTestId("row-owner.zip").click();
  await page.keyboard.press("e");
  await page
    .getByTestId("escalate-input")
    .fill("order sheet says 03029 — which source wins?");
  await page.getByTestId("escalate-input").press("Enter");
  await expect(
    page.getByTestId("row-owner.zip").getByTestId("row-mark"),
  ).toHaveText("↗ escalated");
  // selection advanced to the next queued field; ⏎ confirms it
  await expect(page.getByTestId("sel-label")).toHaveText("MTG 1 — LENDER");
});

// TODO(rebuild): un-skip when this feature lands — rule: no approve-all, no throughput, no timers
test.skip("no approve-all, no throughput, no timers", async ({ page }) => {
  await go(page);
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).not.toContain("approve");
  expect(body).not.toContain("throughput");
  expect(body).not.toContain("per hour");
  expect(body).not.toMatch(/\btimer\b/);
});

// TODO(rebuild): un-skip when this feature lands — rule: J/K walk the queued fields only
test.skip("J/K walk the queued fields only", async ({ page }) => {
  await go(page);
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
  await page.keyboard.press("j");
  await expect(page.getByTestId("sel-label")).toHaveText("MTG 1 — LENDER");
  await page.keyboard.press("j");
  await expect(page.getByTestId("sel-label")).toHaveText("MTG 1 — AMOUNT");
  await page.keyboard.press("k");
  await expect(page.getByTestId("sel-label")).toHaveText("MTG 1 — LENDER");
});

// TODO(rebuild): un-skip when this feature lands — rule: reader B line pins on the page from its coordinates
test.skip("reader B line pins on the page from its coordinates", async ({
  page,
}) => {
  await go(page);
  await page.getByTestId("row-mortgages.1.amount").click();
  await page.getByText("llmwhisperer-hq").first().click();
  await expect(page.getByText(/READER B LINE — llmwhisperer-hq/)).toBeVisible();
});
