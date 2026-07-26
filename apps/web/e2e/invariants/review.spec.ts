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

/*
 * UN-SKIPPED 2026-07-26 (Pass 3, increment 2), and REWRITTEN — this is the one
 * migrated spec whose ASSERTIONS changed, not just its selectors, so the change
 * is spelled out rather than made quietly:
 *
 *  - It covered TWO NA states. It now covers FOUR, per the ratified Q1 ruling.
 *    That is the rule getting stronger, not weaker.
 *  - The old copy ("Not Available", "N/A — EXPECTED", "PRESENT — UNREADABLE")
 *    was the old design's wording. design-mock/ words all four differently, so
 *    the expected strings are its wording now. The RULE — four states that
 *    render distinctly and route oppositely — is unchanged.
 *  - The pending assertion was `not.toContainText("Not Available")`. Under the
 *    new copy that string appears nowhere, so it would have passed trivially
 *    and protected nothing. It now asserts pending carries NONE of the four NA
 *    phrasings, and that it does not render as an NA chip at all.
 *  - Distinctness is additionally pinned structurally: each state renders its
 *    own testid, so a future collapse into one shared render fails here even if
 *    the copy still matches.
 */
test("all four NA states + pending render distinctly", async ({ page }) => {
  await go(page);

  // NOT_PRESENT — structurally absent in this jurisdiction. Correct, and quiet:
  // it must never prompt action. Surfacing it is the ghost-chasing bug.
  const plat = page.getByTestId("row-legal.plat_book_page");
  await expect(plat).toContainText("n/a — not used in this jurisdiction");
  await expect(plat.getByTestId("nv-not-present")).toBeVisible();

  // NOT_FOUND — searched, nothing of record. A real gap, so it IS surfaced.
  const fedLien = page.getByTestId("row-judgments.1.federal_tax_lien");
  await expect(fedLien).toContainText("Not found — searched, none of record");
  await expect(fedLien.getByTestId("nv-not-found")).toBeVisible();

  // NOT_STATED — the instrument exists and is silent on the point.
  const dated = page.getByTestId("row-deed.dated_date");
  await expect(dated).toContainText("Document silent — not stated on any page");
  await expect(dated.getByTestId("nv-not-stated")).toBeVisible();

  // PRESENT_UNREADABLE — on the page and unreadable. The only NA state that
  // cites a page, and it must: it asserts something IS there.
  const caseNo = page.getByTestId("row-judgments.1.case_no");
  await expect(caseNo).toContainText("Present — unreadable on page");
  await expect(caseNo.getByTestId("nv-unreadable-page")).toHaveText("p30");

  // pending — a fifth, distinct render. NOT an NA state: it is a statement
  // about the pipeline, not the document.
  const pending = page.getByTestId("row-assessment.tax_status");
  await expect(pending).toContainText("not yet extracted");
  for (const naPhrase of [
    "Not Available",
    "not used in this jurisdiction",
    "Not found",
    "Document silent",
    "unreadable",
  ]) {
    await expect(pending).not.toContainText(naPhrase);
  }
  // and it is not rendered as an NA chip at all
  for (const chip of [
    "nv-not-present",
    "nv-not-found",
    "nv-not-stated",
    "nv-unreadable",
  ]) {
    await expect(pending.getByTestId(chip)).toHaveCount(0);
  }

  // four NA states, four different renders — the collapse would show up here
  for (const id of [
    "nv-not-present",
    "nv-not-found",
    "nv-not-stated",
    "nv-unreadable",
  ]) {
    await expect(page.getByTestId(id).first()).toBeVisible();
  }

  /*
   * An A/B disagreement is NOT emptiness. This field has no merged value but
   * two readings that both returned something. It arrives on the wire looking
   * exactly like "not yet extracted" — value null, na_reason null — and only
   * `readings` tells them apart. Rendering it as pending tells the reviewer
   * there is nothing to look at while two candidate values sit in the payload.
   *
   * Added here after that defect was caught on screen during increment 2.
   */
  const disagreed = page.getByTestId("row-mortgages.1.lender");
  await expect(disagreed.getByTestId("nv-unsettled")).toBeVisible();
  await expect(disagreed).not.toContainText("not yet extracted");
  await expect(disagreed).not.toContainText("Not Available");
  // and the genuinely-unextracted field is not dressed up as a disagreement
  await expect(pending.getByTestId("nv-unsettled")).toHaveCount(0);
});

// UN-SKIPPED 2026-07-26 (Pass 3, increment 2). Assertion unchanged.
test("a confirmed value without provenance renders visibly flagged", async ({
  page,
}) => {
  await go(page);
  await expect(page.getByTestId("row-judgments.1.amount")).toContainText(
    "NO PROVENANCE",
  );
});

/*
 * UN-SKIPPED 2026-07-27 (Pass 3, increment 3). One copy assertion rewritten:
 * "THEY DISAGREE. THAT IS WHY IT IS YOURS." was the old design's voice. The
 * panel still has to say why the field is the reviewer's — that is the rule —
 * but in design-mock's register. Asserted through the `why-yours` testid plus
 * the substance ("disagree", "yours") rather than a verbatim sentence, so a
 * future copy edit does not fail the test while a missing explanation does.
 *
 * Everything else is unchanged, and two assertions are ADDED: neither reading
 * may be pre-selected, and confidence must not read as a recommendation. Both
 * are hard constraints (5) that this panel is the main opportunity to violate.
 */
test("A≠B disagreement leads: chip on the row, both readings in the panel", async ({
  page,
}) => {
  await go(page);
  const lender = page.getByTestId("row-mortgages.1.lender");
  await expect(lender).toContainText("A≠B");
  await lender.click();

  // the panel says why this field is a person's problem
  const why = page.getByTestId("why-yours");
  await expect(why).toBeVisible();
  await expect(why).toContainText("disagree");
  await expect(why).toContainText("yours");

  // both readings, each attributed to its engine
  await expect(page.getByText("gemini-2.5-flash").first()).toBeVisible();
  await expect(page.getByText("llmwhisperer-hq").first()).toBeVisible();
  await expect(page.getByTestId("reading-gemini-2.5-flash")).toBeVisible();
  await expect(page.getByTestId("reading-llmwhisperer-hq")).toBeVisible();

  // NEITHER is pre-selected or marked as preferred — the page decides, not the
  // engine, and not the UI (constraint 5)
  await expect(why).toContainText("Neither reading is preferred");

  // confidence renders as context, never as a score or endorsement
  const panel = page.getByTestId("decision-panel");
  await expect(panel).toContainText("it decides nothing");
  const body = (await panel.innerText()).toLowerCase();
  for (const forbidden of ["recommended", "best match", "most likely", "winner"]) {
    expect(body).not.toContain(forbidden);
  }
});

// UN-SKIPPED 2026-07-27 (Pass 3, increment 4). rule: correction without a reason never submits
test("correction without a reason never submits", async ({ page }) => {
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

// UN-SKIPPED 2026-07-27 (Pass 3, increment 4). rule: correction with value + reason submits and renders the server's state
test("correction with value + reason submits and renders the server's state", async ({
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

// UN-SKIPPED 2026-07-27 (Pass 3, increment 4). rule: escalation without a question never submits
test("escalation without a question never submits", async ({ page }) => {
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

// UN-SKIPPED 2026-07-27 (Pass 3, increment 4). rule: escalation with a question records; confirm via ⏎ records
test("escalation with a question records; confirm via ⏎ records", async ({
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

// UN-SKIPPED 2026-07-27 (Pass 3, increment 4). rule: no approve-all, no throughput, no timers
test("no approve-all, no throughput, no timers", async ({ page }) => {
  await go(page);
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).not.toContain("approve");
  expect(body).not.toContain("throughput");
  expect(body).not.toContain("per hour");
  expect(body).not.toMatch(/\btimer\b/);
});

// UN-SKIPPED 2026-07-27 (Pass 3, increment 4). rule: J/K walk the queued fields only
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

// TODO(rebuild): needs the document pane + click-to-source (react-pdf), not yet built
test.skip("reader B line pins on the page from its coordinates", async ({
  page,
}) => {
  await go(page);
  await page.getByTestId("row-mortgages.1.amount").click();
  await page.getByText("llmwhisperer-hq").first().click();
  await expect(page.getByText(/READER B LINE — llmwhisperer-hq/)).toBeVisible();
});
