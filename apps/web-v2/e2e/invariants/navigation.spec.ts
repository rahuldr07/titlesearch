import { expect, test } from "@playwright/test";

/**
 * HARVESTED INVARIANTS — migrated from apps/web @ ade49af (pre-rebuild).
 * Source: apps/web/e2e/navigation.spec.ts
 *
 * Every test here is SKIPPED until the feature it covers lands in web-v2.
 * Un-skip as each feature lands. Rewrite selectors freely.
 * NEVER weaken an assertion — if one cannot pass against the new design,
 * that is a CONFLICT in the design: stop and report (BRIEF §5 Phase 5).
 */

// TODO(rebuild) [INVARIANT] — rule: ORPHAN — keyboard IS the navigation layer; ? renders the map. (Promoted to INVARIANT by open-rulings Q3.)
test("g-sequences jump between screens; ? shows the map", async ({ page }) => {
  await page.goto("/queue");
  await expect(page.getByTestId("order-ref")).toBeVisible();
  await page.keyboard.press("g");
  await page.keyboard.press("d");
  await expect(page).toHaveURL(/\/delivered/);
  await page.keyboard.press("g");
  await page.keyboard.press("q");
  await expect(page).toHaveURL(/\/queue/);
  await page.keyboard.press("?");
  const map = page.getByTestId("key-map");
  await expect(map).toContainText("KEYBOARD AS NAVIGATION");
  await expect(map).toContainText("escalation inbox");
  await page.keyboard.press("Escape");
  await expect(map).toHaveCount(0);
});

// TODO(rebuild) [ORPHAN RULE] — rule: ORPHAN O15 — a chord's second key must never ALSO fire a screen action. This is what stops a stray keystroke destroying an in-progress correction. (Promoted by Q3.)
test("a g-sequence's second key never leaks into screen hotkeys", async ({
  page,
}) => {
  await page.goto("/orders/ord_demo_1/review");
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
  // g then e must navigate to escalations, NOT open the correction editor
  // (`e` is the correct hotkey on the review screen)
  await page.keyboard.press("g");
  await page.keyboard.press("e");
  await expect(page).toHaveURL(/\/escalations/);
});

// TODO(rebuild) [ORPHAN RULE] — rule: ORPHAN — the key map is modal: it swallows screen keys while open and restores them on Escape. (Promoted by Q3.)
test("the ? overlay swallows screen keys while open", async ({ page }) => {
  await page.goto("/orders/ord_demo_1/review");
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
  await page.keyboard.press("?");
  await expect(page.getByTestId("key-map")).toBeVisible();
  // `e` (correct) must not open the editor, j must not move — the map is modal
  await page.keyboard.press("e");
  await expect(page.getByTestId("edit-value")).toHaveCount(0);
  await page.keyboard.press("j");
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
  // Escape restores the screen's keys
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("key-map")).toHaveCount(0);
  await page.keyboard.press("j");
  await expect(page.getByTestId("sel-label")).toHaveText("MTG 1 — LENDER");
});

// TODO(rebuild) [INVARIANT] — rule: deep links are first-class — ?field= lands on the exact field in context. (BRIEF §7 makes this URL-owned selection.)
test("?field= deep links land on the exact field in context", async ({
  page,
}) => {
  await page.goto("/orders/ord_demo_1/review?field=judgments.1.case_no");
  await expect(page.getByTestId("sel-label")).toHaveText("JGMT 1 — CASE NO");
  await expect(page.getByTestId("sel-state")).toContainText(
    "PRESENT — UNREADABLE",
  );
});



// TODO(rebuild) [INVARIANT] — rule: the order's states travel with it — the spine shows queue, escalation and delivery state together.
test("the order spine travels with the order on Review", async ({ page }) => {
  await page.goto("/orders/ord_demo_1/review");
  const rail = page.getByTestId("order-rail");
  await expect(rail).toContainText("ord_demo_1");
  await expect(rail).toContainText("still queued");
  await expect(rail).toContainText("escalations open"); // esc cluster spans this order
  await expect(rail).toContainText("delivered v1");
});
