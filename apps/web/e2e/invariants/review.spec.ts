import { expect, test } from "@playwright/test";
import { interceptApi } from "../helpers/net";

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
  await expect(page.getByTestId("row-owner.zip").getByTestId("row-mark")).toHaveCount(
    0,
  );
});

// TODO(rebuild) [INVARIANT] — rule: a recorded escalation marks the row and advances selection to the next queued field.
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
test("reader B line pins on the page from its coordinates", async ({ page }) => {
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

// Task 11 — rule: the full-width top strip carries the order's context on
// every order screen — ref, the four counts, a sign-off stamp, and the
// account trigger. `ord_demo_1`'s field fixture is 21 fields (2 auto-confirmed
// + 12 confirmed + 6 needs_review + 1 pending), so "21" pins the total the
// same way the decision-dock test above pins "18" for the queued subset.
// UPDATED under RULING-2026-08-29 (docs/frontend/design-2026-08/
// RULING-2026-08-29.md): the strip now draws the reference app's bar — the
// bare mono ref (no "ORDER" rubric; the reference draws none), the served
// place line, the served due chip and the Review (N) button. The refusal
// assertions survive untouched: the URL id never appears, the counts are the
// served census, and the stamp is the server's word.
test("the order strip shows the ref, the four counts, and the sign-off stamp", async ({
  page,
}) => {
  await go(page);
  const strip = page.getByTestId("order-strip");
  // The HUMAN ref, from `GET /api/orders/{id}/context`. This asserted
  // "ORDER ord_demo_1" while no endpoint carried the ref; it does now, and the
  // URL id must not appear at all — a strip that prints the id is the defect.
  await expect(strip.getByTestId("order-ref")).toHaveText("4176034-1");
  await expect(strip).not.toContainText("ord_demo_1");
  // The reference bar's served members (RULING-2026-08-29): the finished due
  // label — never a countdown computed here — and the Review (N) button
  // printing the served outstanding census figure.
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
  // The SERVER'S stamp, taken whole. "Not signed" was composed in the browser
  // from `signed_by === null` because nothing on the wire said where the order
  // stood; `stamp.label` does, and the screen may not second-guess it.
  await expect(strip).toContainText("Package incomplete");
  await expect(strip.getByTestId("account-menu")).toBeVisible();
});

/**
 * THE STAMP IS THE SERVER'S WORD, AND THIS PROVES IT RATHER THAN ASSUMING IT.
 *
 * The test above asserts the strip shows "Package incomplete" — which is true,
 * and which a client-side derivation could also produce by accident, because
 * that string is sitting right there in the fixture. Presence is not provenance.
 *
 * This one serves a stamp the browser could not have invented and requires the
 * strip to print it verbatim. If anyone reintroduces the composition this
 * endpoint replaced — `signed_by === null ? "Not signed" : "Signed"`, or any
 * other browser-side lifecycle branch — the served label cannot appear and this
 * fails. Hard rule 3: the server owns every state machine, and a lifecycle word
 * IS a state machine's output.
 *
 * `interceptApi`, not `page.route`: MSW answers from a service worker and
 * Playwright's router cannot see those requests at all (`e2e/helpers/net.ts`).
 *
 * The TONE is asserted through the same channel for the same reason. A screen
 * that took the label from the server and then picked its own colour would have
 * re-implemented half the state machine while looking obedient.
 */
test("the strip prints the server's stamp — it does not compose one", async ({
  page,
}) => {
  await interceptApi(page, {
    method: "GET",
    match: "/api/orders/ord_demo_1/context",
    status: 200,
    // Body widened under RULING-2026-08-29 with the members the reference bar
    // draws (place, client, assigned, due, outstanding, the two stage lists) —
    // the boundary parser refuses a context without them, exactly as it should.
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
 * A REVIEWER READS THE SIGNATURE THEY ARE WORKING AGAINST.
 *
 * The intake sign-off is a claim a person made and put their name to, and every
 * field decision on this screen is taken against it. Until 2026-08-03 the block
 * that shows it existed only as a story: the one screen rendering it
 * (`/questions`) is where a sign-off is ANSWERED and so correctly serves an
 * UNSIGNED order, which meant the read-only branch could not fire anywhere in
 * the running app.
 *
 * WHAT THIS PINS is not the placement — that can move — but the two rules that
 * make the block honest, and both are refusals:
 *
 *   1. It NAMES THE SIGNER. "Signed" without a signer is the claim with the
 *      accountability removed, and for a downstream reviewer this is the only
 *      place the name appears.
 *   2. It OFFERS NO CONTROL. There is no sign-off amendment endpoint and an
 *      append-only signature is not edited in place, so the block renders no
 *      button, no input and no disabled stand-in — a disabled control says "not
 *      now", and the honest statement is "not here".
 */
test("Review shows the intake signature as a record, with no way to edit it", async ({
  page,
}) => {
  await go(page);
  const record = page.getByTestId("signoff-readonly");
  await record.scrollIntoViewIfNeeded();
  await expect(record).toBeVisible();
  // THE SIGNER, BY NAME. Not the word "signed" — a badge reading SIGNED is a
  // state, and the rule is about accountability: this block is the only place
  // downstream where the person who made the claim is named at all.
  await expect(record).toContainText("R. Delacroix");
  // …and when, because a signature without a date cannot be placed against the
  // package it was made about.
  await expect(record).toContainText("2026-07-24");
  // NO CONTROL OF ANY KIND. Counted rather than sampled: a single
  // `not.toBeVisible()` on one selector would pass while another shipped.
  await expect(record.getByRole("button")).toHaveCount(0);
  await expect(record.getByRole("textbox")).toHaveCount(0);
  await expect(record.getByRole("radio")).toHaveCount(0);
  await expect(record.getByRole("checkbox")).toHaveCount(0);
  await expect(record.locator("input, textarea, select")).toHaveCount(0);
});
