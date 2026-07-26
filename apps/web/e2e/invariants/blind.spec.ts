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
 * Blind Fifty typist — §0.6 rules are absolute, each one a test:
 * structurally blind (no engine/model strings anywhere), seat labels only,
 * three-part entry contract, TYPE second pass, minimal submit response.
 */

const go = async (page: import("@playwright/test").Page) => {
  await page.goto("/blind/ord_demo_1");
  await expect(page.getByTestId("blind-seat")).toBeVisible();
};

// TODO(rebuild): un-skip when this feature lands — rule: the page is structurally blind — no engine, model, or pipeline strings
test("the page is structurally blind — no engine, model, or pipeline strings", async ({
  page,
}) => {
  await go(page);
  const html = (await page.content()).toLowerCase();
  for (const forbidden of [
    "gemini",
    "llmwhisperer",
    "paddle",
    "tesseract",
    "engine",
    "model output",
    "auto_confirm",
    "needs_review",
    "confidence_raw",
    "reader a",
    "reader b",
  ]) {
    expect(html, `page must not contain "${forbidden}"`).not.toContain(
      forbidden,
    );
  }
  // seat label only — never a name
  await expect(page.getByTestId("blind-seat")).toContainText("typist B");
  expect(html).not.toContain("l. vance");
});

// TODO(rebuild): un-skip when this feature lands — rule: no clock, no rate, no score
test("no clock, no rate, no score", async ({ page }) => {
  await go(page);
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).toContain("no clock, no rate, no score");
  expect(body).not.toMatch(/\btimer\b/);
  expect(body).not.toMatch(/\d+ per hour/);
});

// TODO(rebuild): un-skip when this feature lands — rule: the three-part contract gates Record: value/NA + source + confidence
test("the three-part contract gates Record: value/NA + source + confidence", async ({
  page,
}) => {
  await go(page);
  const path = "mortgages.1.lender";
  await expect(page.getByTestId(`record-${path}`)).toHaveCount(0);
  await page.getByTestId(`value-${path}`).fill("ROBINS DEMO CU");
  await expect(page.getByTestId(`record-${path}`)).toHaveCount(0); // no source yet
  await page.getByTestId(`source-${path}`).fill("security deed 09812/44, p 9");
  await expect(page.getByTestId(`record-${path}`)).toHaveCount(0); // no confidence yet
  await page.getByTestId(`conf-certain-${path}`).click();
  await page.getByTestId(`record-${path}`).click();
  await expect(page.getByTestId(`settled-${path}`)).toContainText(
    "ROBINS DEMO CU",
  );
});

// TODO(rebuild): un-skip when this feature lands — rule: unclear with a source is a legitimate, recordable answer
test("unclear with a source is a legitimate, recordable answer", async ({
  page,
}) => {
  await go(page);
  const path = "mortgages.1.amount";
  await page.getByTestId(`field-${path}`).getByText("UNREADABLE").click();
  await page.getByTestId(`source-${path}`).fill("security deed p 11 — stamp over the numerals");
  await page.getByTestId(`conf-unclear-${path}`).click();
  await page.getByTestId(`record-${path}`).click();
  await expect(page.getByTestId(`settled-${path}`)).toContainText(
    "PRESENT_UNREADABLE",
  );
});

// TODO(rebuild): un-skip when this feature lands — rule: judgment TYPE takes a second pass and gates its siblings
test("judgment TYPE takes a second pass and gates its siblings", async ({
  page,
}) => {
  await go(page);
  await page.getByText("judgments_liens").click();
  await expect(
    page.getByText("opens after TYPE is recorded above").first(),
  ).toBeVisible();
  const path = "judgments.1.type";
  await page.getByTestId(`value-${path}`).fill("Lis Pendens");
  await page.getByTestId(`source-${path}`).fill("FiFa search p 31, caption");
  await page.getByTestId(`conf-certain-${path}`).click();
  // no Record yet — the second-pass gate stands in front of it
  await expect(page.getByTestId(`record-${path}`)).toHaveCount(0);
  await page.getByTestId("type-gate-confirm").click();
  await page.getByTestId(`record-${path}`).click();
  await expect(page.getByTestId("field-judgments.1.plaintiff")).toBeVisible();
});

// TODO(rebuild): un-skip when this feature lands — rule: submit renders only the local confirmation — nothing comes back
test("submit renders only the local confirmation — nothing comes back", async ({
  page,
}) => {
  await go(page);
  const path = "mortgages.1.lender";
  await page.getByTestId(`value-${path}`).fill("ROBINS DEMO CU");
  await page.getByTestId(`source-${path}`).fill("security deed p 9");
  await page.getByTestId(`conf-certain-${path}`).click();
  await page.getByTestId(`record-${path}`).click();
  await page.getByTestId("blind-submit").click();
  const card = page.getByTestId("blind-submitted");
  await expect(card).toContainText("Submitted.");
  await expect(card).toContainText("you will not see the other set of answers");
  // entry ids and everything else stay out of the render
  expect((await page.content()).toLowerCase()).not.toContain("be_1");
});
