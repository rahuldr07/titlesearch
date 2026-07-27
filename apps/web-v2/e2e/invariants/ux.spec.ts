import { expect, test } from "@playwright/test";

/**
 * HARVESTED INVARIANTS — migrated from apps/web @ ade49af (pre-rebuild).
 * Source: apps/web/e2e/ux.spec.ts
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
// TODO(rebuild) [ORPHAN RULE] — rule: ORPHAN — when both engines found a value and disagree, the UI must never claim extraction returned nothing. The draft leads, labelled as a draft.
test.skip("a both-found disagreement never claims emptiness — draft leads, labeled", async ({
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
  await expect(
    page.getByText("extraction returned nothing at all"),
  ).toHaveCount(0);
});

// TODO(rebuild) [ORPHAN RULE] — rule: ORPHAN — the differing characters between two readings are highlighted, so the reviewer sees WHERE they diverge.
test.skip("differing characters between readings are highlighted", async ({
  page,
}) => {
  await go(page);
  await page.getByTestId("row-mortgages.1.lender").click();
  const marks = page.getByTestId("diff-hl");
  await expect(marks.first()).toBeVisible();
  expect(await marks.count()).toBeGreaterThan(0);
});

// TODO(rebuild) [ORPHAN RULE] — rule: ORPHAN — a reading can be adopted into the correction editor without retyping. Transcription is a defect source.
test.skip("a reading can be adopted into the correction editor without retyping", async ({
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

// TODO(rebuild) [ORPHAN RULE] — rule: ORPHAN O9 — Enter never accepts a blank. A missing field demands an explicit click. This is the only keyboard-layer defence against bulk-accepting absences.
test.skip("⏎ never accepts a blank — missing fields demand a click", async ({
  page,
}) => {
  await page.goto("/orders/ord_demo_1/review?field=mortgages.1.lender");
  await expect(page.getByTestId("sel-label")).toHaveText("MTG 1 — LENDER");
  await page.keyboard.press("Enter");
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

// TODO(rebuild) [ORPHAN RULE] — rule: ORPHAN — every refusal speaks: escalate, correct and pass each nudge with what is missing. A silent no-op is the defect.
test.skip("refused submits SAY so — escalate, correct, pass all nudge", async ({
  page,
}) => {
  await go(page);
  // empty escalation
  await page.getByTestId("row-owner.zip").click();
  await page.keyboard.press("e");
  await page.getByTestId("escalate-input").press("Enter");
  await expect(page.getByTestId("nudge")).toContainText("needs its question");
  await page.keyboard.press("Escape");
  // correction without its why
  await page.keyboard.press("c");
  await page.getByTestId("edit-value").press("Enter");
  await expect(page.getByTestId("nudge")).toContainText(
    "both the value and its why",
  );
  await page.keyboard.press("Escape");
  // pass without a reason (review header popover)
  await page.keyboard.press("p");
  await page.locator("input:focus").press("Enter");
  await expect(page.getByTestId("nudge")).toContainText("a pass needs its why");
});

// TODO(rebuild) [ORPHAN RULE] — rule: ORPHAN — the queue's pass refusal nudges too.
test.skip("the queue's pass refusal nudges too", async ({ page }) => {
  await page.goto("/queue");
  await expect(page.getByTestId("order-ref")).toBeVisible();
  await page.keyboard.press("p");
  await page.locator("input:focus").press("Enter");
  await expect(page.getByTestId("nudge")).toContainText("a pass needs its why");
});

// TODO(rebuild) [INVARIANT] — rule: A MOUSE USER IS NEVER STRANDED. Every screen
// offers a pointer path back to the hub. RESTORED 2026-07-27: this was dropped as
// STRUCTURAL on the claim that errors.spec and home.spec carry the rule. They do
// not — errors.spec covers error states (unknown route, 500s, stale links), not
// returning home from a WORKING screen, and no migrated spec clicks a way home.
// The mechanism (a TopBar title) is old-UI and disposable; the rule is not, and
// commit c2e9011 deleted the side rail that was the other mouse path home.
// Re-selector to whatever the new design uses; do not weaken the assertion.
test.skip("every screen's title is the mouse path home", async ({ page }) => {
  await go(page);
  // the screen TITLE, not a rail door, is the mouse path home
  await page.getByTestId("screen-title").click();
  await expect(page.getByTestId("home-hub")).toBeVisible();
  await page.getByTestId("door-/queue").click();
  await page.getByTestId("screen-title").click();
  await expect(page.getByTestId("home-hub")).toBeVisible();
});
