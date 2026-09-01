import { expect, test } from "@playwright/test";
import { interceptApi } from "../helpers/net";

/**
 * Never weaken an assertion — a test that cannot pass against the new
 * design is a conflict in the design: stop and report.
 */

const go = async (page: import("@playwright/test").Page) => {
  await page.goto("/orders/ord_demo_1/review");
  await expect(page.getByTestId("sel-label")).toBeVisible();
};
// Rule: the NA states are never collapsed, and `pending` is a distinct third render that never reads as an NA.
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

// Rule: a value with no provenance renders as a visible hard error — never a blank, never a bare value.
test("a confirmed value without provenance renders visibly flagged", async ({
  page,
}) => {
  await go(page);
  await expect(page.getByTestId("row-judgments.1.amount")).toContainText(
    "NO PROVENANCE",
  );
});

// Rule: engine disagreement is surfaced on the row and both readings are shown attributed in the panel.
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

// Rule: a correction is refused without its reason.
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

// Rule: the server's returned state is what renders — never an optimistic local mutation.
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

// Rule: an escalation is refused without its question.
test("escalation without a question never submits", async ({ page }) => {
  await go(page);
  await page.getByTestId("row-owner.zip").click();
  // escalate is a BUTTON now (no hotkey) — `e` opens the correction editor.
  await page.getByTestId("act-escalate").click();
  const input = page.getByTestId("escalate-input");
  await expect(input).toBeFocused();
  await input.press("Enter");
  await expect(input).toBeVisible(); // still open, nothing sent
  await expect(page.getByTestId("row-owner.zip").getByTestId("row-mark")).toHaveCount(
    0,
  );
});

// Rule: a recorded escalation marks the row and advances selection to the next queued field.
test("escalation with a question records and advances selection", async ({ page }) => {
  await go(page);
  await page.getByTestId("row-owner.zip").click();
  // escalate is a BUTTON now (no hotkey).
  await page.getByTestId("act-escalate").click();
  await page
    .getByTestId("escalate-input")
    .fill("order sheet says 03029 — which source wins?");
  await page.getByTestId("escalate-input").press("Enter");
  await expect(page.getByTestId("row-owner.zip").getByTestId("row-mark")).toHaveText(
    "↗ escalated",
  );
  // selection advanced to the next queued field
  await expect(page.getByTestId("sel-label")).toHaveText("MTG 1 — LENDER");
});

// Rule: no approve-all, no throughput language, no timers anywhere on the review workstation.
test("no approve-all, no throughput, no timers", async ({ page }) => {
  await go(page);
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).not.toContain("approve");
  expect(body).not.toContain("throughput");
  expect(body).not.toContain("per hour");
  expect(body).not.toMatch(/\btimer\b/);
});

// Rule (recorded nowhere else): field navigation visits ONLY server-queued fields. A reviewer cannot walk into auto-confirmed fields.
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

// Rule: provenance coordinates render as a pin on the source page raster.
test("reader B line pins on the page from its coordinates", async ({ page }) => {
  await go(page);
  await page.getByTestId("row-mortgages.1.amount").click();
  await page.getByText("llmwhisperer-hq").first().click();
  await expect(page.getByText(/READER B LINE — llmwhisperer-hq/)).toBeVisible();
});

// Rule: the coverage spine covers the whole package (`total_pages`), never
// just the pages a reader typed — a cell for every package page, and the
// summary cites the total.
test("coverage spine renders one cell per package page, not just read ones", async ({
  page,
}) => {
  await go(page);
  await expect(page.getByText(/Coverage · all 64 pages/)).toBeVisible();
  await expect(page.getByTestId("coverage-cell")).toHaveCount(64);
});

// Rule: decision progress is derived from server `state`, never a
// throughput number. The dock's denominator is the fields ever flagged for
// a person (confirmed + needs_review), not the order's full field count —
// counting auto_confirmed and pending would make them somebody's decision.
test("decision dock shows real answered-of-total progress from field state", async ({
  page,
}) => {
  await go(page);
  const dock = page.getByTestId("decision-dock");
  // The answered-of-total caption is the hub verdict card's, not this
  // screen's; the bar's own meter carries it here. What the dock owns is the
  // queue remainder: default selection lands on the first queued field
  // (owner.zip), so one of the 18 is "open" and the rest is 17.
  await expect(page.getByTestId("verified-meter-label")).toHaveText("12/18 VERIFIED");
  await expect(dock).toContainText("Rest of the queue · 17");
});

// Rule: the rail jumps to the same section grouping the draft sheet renders
// (`reportSections.sectionsOf`, shared by both) — a rail link and the sheet
// section it names must never drift apart into two different splits.
test("section rail jumps to the matching report section", async ({ page }) => {
  await go(page);
  const link = page.getByTestId("section-link-judgments");
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/#section-judgments$/);
  await expect(page.locator("#section-judgments")).toBeInViewport();
});

// Rule: the full-width top strip carries the order's context on every order
// screen — the bare mono ref, the served place line, the served due chip,
// the Review (N) button, the four counts, a sign-off stamp, and the account
// trigger. The URL id never appears, the counts are the served census, and
// the stamp is the server's word.
test("the order strip shows the ref, the four counts, and the sign-off stamp", async ({
  page,
}) => {
  await go(page);
  const strip = page.getByTestId("order-strip");
  // The human ref, from `GET /api/orders/{id}/context`. The URL id must not
  // appear at all — a strip that prints the id is the defect.
  await expect(strip.getByTestId("order-ref")).toHaveText("4176034-1");
  await expect(strip).not.toContainText("ord_demo_1");
  // The bar's served members: the finished due label — never a countdown
  // computed here — and the Review (N) button printing the served
  // outstanding census figure.
  await expect(strip.getByTestId("order-due")).toHaveText("Due today · 5h 20m left");
  await expect(strip.getByTestId("order-review-cta")).toHaveText("Review (6)");
  // The five stage tabs, served per order, with Examination badged "6".
  const tabs = strip.getByTestId("order-strip-stages");
  await expect(tabs).toContainText("Examination Workstation");
  await expect(tabs).toContainText("Delivery & Gateway Seal");
  const counts = page.getByTestId("order-counts");
  await expect(counts).toContainText("21");
  for (const label of ["Fields", "Auto-confirmed", "Need you", "No source"]) {
    await expect(counts).toContainText(label);
  }
  // The server's stamp, taken whole — `stamp.label` says where the order
  // stands, and the screen may not second-guess it.
  await expect(strip).toContainText("Package incomplete");
  await expect(strip.getByTestId("account-menu")).toBeVisible();
});

/**
 * The stamp is the server's word, proved rather than assumed: this serves a
 * stamp the browser could not have invented and requires the strip to print
 * it verbatim — any browser-side lifecycle branch would fail here. The tone
 * is asserted through the same channel: a screen that took the label from
 * the server and then picked its own colour would have re-implemented half
 * the state machine. `interceptApi`, not `page.route`: MSW answers from a
 * service worker Playwright's router cannot see (`e2e/helpers/net.ts`).
 */
test("the strip prints the server's stamp — it does not compose one", async ({
  page,
}) => {
  await interceptApi(page, {
    method: "GET",
    match: "/api/orders/ord_demo_1/context",
    status: 200,
    // The boundary parser refuses a context without the bar's members
    // (place, client, assigned, due, outstanding, the two stage lists).
    body: {
      order_id: "ord_demo_1",
      order_ref: "4176034-1",
      product: "40-Year Search",
      period_label: "40-year period · 07/18/1986 – 07/18/2026",
      pages: 64,
      // Not derivable from any field the browser holds, and deliberately not a
      // word this product's vocabulary contains anywhere else.
      stamp: { label: "Held for counsel", tone: "attend" },
      place: "4152 Creekstone Dr, Demoville GA · Clayton County, GA",
      client: "Riverbend Title",
      assigned: "R. Okafor",
      due: "Due today · 5h 20m left",
      outstanding: 6,
      stage_nav: [],
      stage_tabs: [],
    },
  });
  await go(page);
  const strip = page.getByTestId("order-strip");
  await expect(strip).toContainText("Held for counsel");
  // …and the fixture's own label is GONE, so the strip cannot be printing both
  // or falling back to something it worked out for itself.
  await expect(strip).not.toContainText("Package incomplete");
  // The tone rides the same response: `attend`, not the fixture's `halt`.
  await expect(strip.getByTestId("order-stamp")).toHaveAttribute("data-tone", "attend");
});

/**
 * A reviewer reads the signature they are working against. What this pins
 * is not the placement but the two rules that make the block honest:
 *   1. It names the signer — "Signed" without a signer is the claim with
 *      the accountability removed.
 *   2. It offers no control — an append-only signature is not edited in
 *      place, so no button, no input, no disabled stand-in; a disabled
 *      control says "not now", and the honest statement is "not here".
 */
test("Review shows the intake signature as a record, with no way to edit it", async ({
  page,
}) => {
  await go(page);
  const record = page.getByTestId("signoff-readonly");
  await record.scrollIntoViewIfNeeded();
  await expect(record).toBeVisible();
  // The signer, by name — a badge reading SIGNED is a state, and the rule
  // is about accountability: this block is the only place downstream where
  // the person who made the claim is named at all.
  await expect(record).toContainText("R. Delacroix");
  // …and when, because a signature without a date cannot be placed against the
  // package it was made about.
  await expect(record).toContainText("2026-07-24");
  // No control of any kind. Counted rather than sampled: a single
  // `not.toBeVisible()` on one selector would pass while another shipped.
  await expect(record.getByRole("button")).toHaveCount(0);
  await expect(record.getByRole("textbox")).toHaveCount(0);
  await expect(record.getByRole("radio")).toHaveCount(0);
  await expect(record.getByRole("checkbox")).toHaveCount(0);
  await expect(record.locator("input, textarea, select")).toHaveCount(0);
});
