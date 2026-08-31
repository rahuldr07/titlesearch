import { expect, test } from "@playwright/test";

/**
 * Never weaken an assertion — a test that cannot pass against the new
 * design is a conflict in the design: stop and report.
 */

const go = async (page: import("@playwright/test").Page) => {
  await page.goto("/orders/ord_demo_1/review");
  await expect(page.getByTestId("sel-label")).toBeVisible();
};
// Rule (recorded nowhere else): when both engines found a value and disagree, the UI must never claim extraction returned nothing. The draft leads, labelled as a draft.
test("a both-found disagreement never claims emptiness — draft leads, labeled", async ({
  page,
}) => {
  await go(page);
  await page.getByTestId("row-mortgages.1.lender").click();
  // the pill states the true situation…
  await expect(page.getByTestId("sel-state")).toHaveText(
    "ENGINES DISAGREE — NOTHING SETTLED",
  );
  // …the headline shows the draft AS a draft, not "Not Available"…
  await expect(page.getByText("draft — nothing settled yet")).toBeVisible();
  // …and nothing claims extraction returned nothing while readings show values
  await expect(page.getByText("extraction returned nothing at all")).toHaveCount(0);
});

// Rule (recorded nowhere else): the differing characters between two readings are highlighted, so the reviewer sees WHERE they diverge.
test("differing characters between readings are highlighted", async ({ page }) => {
  await go(page);
  await page.getByTestId("row-mortgages.1.lender").click();
  const marks = page.getByTestId("diff-hl");
  await expect(marks.first()).toBeVisible();
  expect(await marks.count()).toBeGreaterThan(0);
});

// Rule (recorded nowhere else): a reading can be adopted into the correction editor without retyping. Transcription is a defect source.
test("a reading can be adopted into the correction editor without retyping", async ({
  page,
}) => {
  await go(page);
  await page.getByTestId("row-mortgages.1.amount").click();
  await page.getByTestId(/^use-/).first().click();
  const value = page.getByTestId("edit-value");
  await expect(value).toBeVisible();
  // prefilled with the reading's exact value — no transcription
  await expect(value).toHaveValue(/^\$[\d,]+\.\d{2}$/);
  const reason = page.getByTestId("edit-reason");
  await reason.fill("words line is legible — matches this reading");
  await reason.press("Enter");
  await expect(
    page.getByTestId("row-mortgages.1.amount").getByTestId("row-mark"),
  ).toHaveText("✎ corrected");
});

// [ORPHAN RULE O9] — the confirm key never accepts a blank. The design remap
// moved confirm off ⏎ onto `c` (C confirm · E correct); the RULE moved with it.
// A missing field still demands an explicit click — the only keyboard-layer
// defence against bulk-accepting absences by holding the confirm key down.
test("c never accepts a blank — missing fields demand a click", async ({ page }) => {
  await page.goto("/orders/ord_demo_1/review?field=mortgages.1.lender");
  await expect(page.getByTestId("sel-label")).toHaveText("MTG 1 — LENDER");
  await page.keyboard.press("c");
  // nothing happened: no mark, selection unmoved
  await expect(
    page.getByTestId("row-mortgages.1.lender").getByTestId("row-mark"),
  ).toHaveCount(0);
  await expect(page.getByTestId("sel-label")).toHaveText("MTG 1 — LENDER");
  // the explicit click still works
  await page.getByTestId("act-confirm").click();
  await expect(
    page.getByTestId("row-mortgages.1.lender").getByTestId("row-mark"),
  ).toHaveText("✓ accepted N/A");
});

// [§11.1] — a correction must CHANGE something. `e` opens the field, but the
// submit stays inert while the value is empty or identical to the machine read,
// and a bare Enter on an unchanged value records nothing. The must-change gate
// is the courtesy; the contract's min(1)/diff is the enforcement.
test("a correction is inert until it differs from the machine read", async ({
  page,
}) => {
  await page.goto("/orders/ord_demo_1/review?field=owner.zip");
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
  await page.keyboard.press("e");
  const value = page.getByTestId("edit-value");
  await expect(value).toBeFocused();
  // seeded with the machine read ("30296"): submit is inert, Enter records nothing
  await expect(page.getByTestId("edit-submit")).toBeDisabled();
  await value.press("Enter");
  await expect(page.getByTestId("row-owner.zip").getByTestId("row-mark")).toHaveCount(
    0,
  );
  // a real change arms the submit
  await value.fill("30999");
  await expect(page.getByTestId("edit-submit")).toBeEnabled();
});

// Rule (recorded nowhere else): every refusal speaks: escalate, correct and pass each nudge with what is missing. A silent no-op is the defect.
test("refused submits SAY so — escalate, correct, pass all nudge", async ({ page }) => {
  await go(page);
  // empty escalation — escalate is a BUTTON now (no hotkey); its editor still
  // refuses an empty question.
  await page.getByTestId("row-owner.zip").click();
  await page.getByTestId("act-escalate").click();
  await page.getByTestId("escalate-input").press("Enter");
  await expect(page.getByTestId("nudge")).toContainText("needs its question");
  await page.keyboard.press("Escape");
  // correction without its why — `e` opens the field; a CHANGED value clears the
  // must-change gate, then submitting with no reason nudges for the why.
  await page.keyboard.press("e");
  await page.getByTestId("edit-value").fill("30999");
  await page.getByTestId("edit-value").press("Enter");
  await expect(page.getByTestId("nudge")).toContainText("both the value and its why");
  await page.keyboard.press("Escape");
  // pass without a reason (review header popover)
  await page.keyboard.press("p");
  await page.locator("input:focus").press("Enter");
  await expect(page.getByTestId("nudge")).toContainText("a pass needs its why");
});

// Rule (recorded nowhere else): the queue's pass refusal nudges too.
test("the queue's pass refusal nudges too", async ({ page }) => {
  await page.goto("/orders/ord_demo_1");
  await expect(page.getByTestId("order-ref")).toBeVisible();
  await page.keyboard.press("p");
  await page.locator("input:focus").press("Enter");
  await expect(page.getByTestId("nudge")).toContainText("a pass needs its why");
});
