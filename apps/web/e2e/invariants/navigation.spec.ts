import { expect, test } from "@playwright/test";

/**
 * Never weaken an assertion — a test that cannot pass against the new
 * design is a conflict in the design: stop and report.
 */

// Rule (recorded nowhere else): keyboard IS the navigation layer; ? renders the map.
test("g-sequences jump between screens; ? shows the map", async ({ page }) => {
  await page.goto("/orders/ord_demo_1");
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

// Rule (recorded nowhere else): a chord's second key must never ALSO fire a screen action. This is what stops a stray keystroke destroying an in-progress correction.
test("a g-sequence's second key never leaks into screen hotkeys", async ({ page }) => {
  await page.goto("/orders/ord_demo_1/review");
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
  // g then e must navigate to escalations, NOT open the correction editor
  // (`e` is the correct hotkey on the review screen)
  await page.keyboard.press("g");
  await page.keyboard.press("e");
  await expect(page).toHaveURL(/\/escalations/);
});

// Rule (recorded nowhere else): the key map is modal: it swallows screen keys while open and restores them on Escape.
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

// Rule: deep links are first-class — ?field= lands on the exact field in context (URL-owned selection).
test("?field= deep links land on the exact field in context", async ({ page }) => {
  await page.goto("/orders/ord_demo_1/review?field=judgments.1.case_no");
  await expect(page.getByTestId("sel-label")).toHaveText("JGMT 1 — CASE NO");
  await expect(page.getByTestId("sel-state")).toContainText("PRESENT — UNREADABLE");
});

// Rule: the order's states travel with it — the spine shows queue, escalation and delivery state together.
test("the order spine travels with the order on Review", async ({ page }) => {
  await page.goto("/orders/ord_demo_1/review");
  const rail = page.getByTestId("order-rail");
  await expect(rail).toContainText("ord_demo_1");
  await expect(rail).toContainText("still queued");
  await expect(rail).toContainText("escalations open"); // esc cluster spans this order
});

// The delivery half of the same rule, asserted on an order that has a
// delivery: queue and escalation state above, delivery state here, each on
// an order it is actually true of.
test("delivery state travels with the order too", async ({ page }) => {
  await page.goto("/orders/ord_demo_13/review");
  const rail = page.getByTestId("order-rail");
  await expect(rail).toContainText("ord_demo_13");
  await expect(rail).toContainText("delivered v1");
  await expect(rail).toContainText("delivered v2");
  // …and it is NOT the served order, so the queue chip must be absent.
  await expect(rail).not.toContainText("still queued");
});
