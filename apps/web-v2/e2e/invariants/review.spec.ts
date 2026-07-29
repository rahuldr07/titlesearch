import { expect, test } from "@playwright/test";

/**
 * HARVESTED INVARIANTS — migrated from apps/web @ ade49af (pre-rebuild).
 * Source: apps/web/e2e/review.spec.ts
 *
 * Every test here is SKIPPED until the feature it covers lands in web-v2.
 * Un-skip as each feature lands. Rewrite selectors freely.
 * NEVER weaken an assertion — if one cannot pass against the new design,
 * that is a CONFLICT in the design: stop and report (BRIEF §5 Phase 5).
 */

const go = async (page: import("@playwright/test").Page) => {
  await page.goto("/orders/ord_demo_1/review");
  await expect(page.getByTestId("sel-label")).toBeVisible();
};
// TODO(rebuild) [INVARIANT] — rule: the NA states are never collapsed, and `pending` is a distinct third render that never reads as an NA.
test("both NA states + pending render distinctly", async ({ page }) => {
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

// TODO(rebuild) [INVARIANT] — rule: a value with no provenance renders as a visible hard error — never a blank, never a bare value.
test("a confirmed value without provenance renders visibly flagged", async ({
  page,
}) => {
  await go(page);
  await expect(page.getByTestId("row-judgments.1.amount")).toContainText(
    "NO PROVENANCE",
  );
});

// TODO(rebuild) [INVARIANT] — rule: engine disagreement is surfaced on the row and both readings are shown attributed in the panel.
test("A≠B disagreement leads: chip on the row, both readings in the panel", async ({
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

// TODO(rebuild) [INVARIANT] — rule: a correction is refused without its reason.
test("correction without a reason never submits", async ({ page }) => {
  await go(page);
  await page.getByTestId("row-mortgages.1.lender").click();
  await page.keyboard.press("e");
  const value = page.getByTestId("edit-value");
  await expect(value).toBeFocused();
  // value present (seeded from Reader A, differs from the null machine read),
  // reason empty → Enter must do nothing
  await value.press("Enter");
  await expect(page.getByTestId("edit-reason")).toBeVisible();
  await expect(
    page.getByTestId("row-mortgages.1.lender").getByTestId("row-mark"),
  ).toHaveCount(0);
});

// TODO(rebuild) [INVARIANT] — rule: the server's returned state is what renders — never an optimistic local mutation.
test("correction with value + reason submits and renders the server's state", async ({
  page,
}) => {
  await go(page);
  await page.getByTestId("row-mortgages.1.lender").click();
  await page.keyboard.press("e");
  await page.getByTestId("edit-value").fill("SOUTHSTONE MORTGAGE LLC");
  const reason = page.getByTestId("edit-reason");
  await reason.fill("page reads SOUTHSTONE; B's zeros are the OCR failure mode");
  await reason.press("Enter");
  await expect(
    page.getByTestId("row-mortgages.1.lender").getByTestId("row-mark"),
  ).toHaveText("✎ corrected");
});

// TODO(rebuild) [INVARIANT] — rule: an escalation is refused without its question.
test("escalation without a question never submits", async ({ page }) => {
  await go(page);
  await page.getByTestId("row-owner.zip").click();
  // escalate is a BUTTON now (no hotkey) — `e` opens the correction editor.
  await page.getByTestId("act-escalate").click();
  const input = page.getByTestId("escalate-input");
  await expect(input).toBeFocused();
  await input.press("Enter");
  await expect(input).toBeVisible(); // still open, nothing sent
  await expect(
    page.getByTestId("row-owner.zip").getByTestId("row-mark"),
  ).toHaveCount(0);
});

// TODO(rebuild) [INVARIANT] — rule: a recorded escalation marks the row and advances selection to the next queued field.
test("escalation with a question records and advances selection", async ({
  page,
}) => {
  await go(page);
  await page.getByTestId("row-owner.zip").click();
  // escalate is a BUTTON now (no hotkey).
  await page.getByTestId("act-escalate").click();
  await page
    .getByTestId("escalate-input")
    .fill("order sheet says 03029 — which source wins?");
  await page.getByTestId("escalate-input").press("Enter");
  await expect(
    page.getByTestId("row-owner.zip").getByTestId("row-mark"),
  ).toHaveText("↗ escalated");
  // selection advanced to the next queued field
  await expect(page.getByTestId("sel-label")).toHaveText("MTG 1 — LENDER");
});

// TODO(rebuild) [INVARIANT] — rule: no approve-all, no throughput language, no timers anywhere on the review workstation.
test("no approve-all, no throughput, no timers", async ({ page }) => {
  await go(page);
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).not.toContain("approve");
  expect(body).not.toContain("throughput");
  expect(body).not.toContain("per hour");
  expect(body).not.toMatch(/\btimer\b/);
});

// TODO(rebuild) [INVARIANT] — rule: ORPHAN O20 — field navigation visits ONLY server-queued fields. A reviewer cannot walk into auto-confirmed fields. (Promoted to INVARIANT by open-rulings Q3.)
test("J/K walk the queued fields only", async ({ page }) => {
  await go(page);
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
  await page.keyboard.press("j");
  await expect(page.getByTestId("sel-label")).toHaveText("MTG 1 — LENDER");
  await page.keyboard.press("j");
  await expect(page.getByTestId("sel-label")).toHaveText("MTG 1 — AMOUNT");
  await page.keyboard.press("k");
  await expect(page.getByTestId("sel-label")).toHaveText("MTG 1 — LENDER");
});

// TODO(rebuild) [INVARIANT] — rule: provenance coordinates render as a pin on the source page raster.
test("reader B line pins on the page from its coordinates", async ({
  page,
}) => {
  await go(page);
  await page.getByTestId("row-mortgages.1.amount").click();
  await page.getByText("llmwhisperer-hq").first().click();
  await expect(page.getByText(/READER B LINE — llmwhisperer-hq/)).toBeVisible();
});

// Task 6 — rule: the coverage spine covers the WHOLE package (`total_pages`),
// never just the pages a reader typed. `ord_demo_1`'s fixture ships 64 total
// pages and served text for only a handful of them; the spine must still
// draw a cell for every package page, and the summary must cite the total.
test("coverage spine renders one cell per package page, not just read ones", async ({
  page,
}) => {
  await go(page);
  await expect(page.getByText(/Coverage · all 64 pages/)).toBeVisible();
  await expect(page.getByTestId("coverage-cell")).toHaveCount(64);
});

// Task 7 — rule: decision progress is DERIVED FROM SERVER `state`, never a
// throughput number. `ord_demo_1` carries 12 confirmed + 6 needs_review = 18
// fields the pipeline ever flagged for a person; the dock's denominator must
// be that 18, not the order's full 21-field count (which would silently
// count the 2 auto_confirmed + 1 pending fields as somebody's decision).
test("decision dock shows real answered-of-total progress from field state", async ({
  page,
}) => {
  await go(page);
  const dock = page.getByTestId("decision-dock");
  await expect(dock).toContainText("12 of 18 answered");
  // default selection lands on the first queued field (owner.zip) — one of
  // the 18 is "open", so the rest of THIS order's queue is 17.
  await expect(dock).toContainText("Rest of the queue · 17");
});

// Task 7 — rule: the rail jumps to the SAME section grouping the draft sheet
// renders (`reportSections.sectionsOf`, shared by both) — a rail link and the
// sheet section it names must never drift apart into two different splits.
test("section rail jumps to the matching report section", async ({ page }) => {
  await go(page);
  const link = page.getByTestId("section-link-judgments");
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/#section-judgments$/);
  await expect(page.locator("#section-judgments")).toBeInViewport();
});
