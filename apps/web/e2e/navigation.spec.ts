import { expect, test } from "@playwright/test";

/**
 * Navigation intelligence: g-sequences + the ? map (keyboard as navigation),
 * ?field= deep links into Review (deep links are first-class), Seed
 * Correction reachable only with context, and the order spine on Review
 * (states travel with you).
 */

test("g-sequences jump between screens; ? shows the map", async ({ page }) => {
  await page.goto("/queue");
  await expect(page.getByTestId("order-ref")).toBeVisible();
  await page.keyboard.press("g");
  await page.keyboard.press("d");
  await expect(page).toHaveURL(/\/dashboard/);
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

test("a g-sequence's second key never leaks into screen hotkeys", async ({
  page,
}) => {
  await page.goto("/orders/ord_demo_1/review");
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
  // g then e must navigate to escalations, NOT open the escalate input
  await page.keyboard.press("g");
  await page.keyboard.press("e");
  await expect(page).toHaveURL(/\/escalations/);
});

test("the ? overlay swallows screen keys while open", async ({ page }) => {
  await page.goto("/orders/ord_demo_1/review");
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
  await page.keyboard.press("?");
  await expect(page.getByTestId("key-map")).toBeVisible();
  // c must not open the editor, j must not move — the map is modal
  await page.keyboard.press("c");
  await expect(page.getByTestId("edit-value")).toHaveCount(0);
  await page.keyboard.press("j");
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
  // Escape restores the screen's keys
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("key-map")).toHaveCount(0);
  await page.keyboard.press("j");
  await expect(page.getByTestId("sel-label")).toHaveText("MTG 1 — LENDER");
});

test("?field= deep links land on the exact field in context", async ({
  page,
}) => {
  await page.goto("/orders/ord_demo_1/review?field=judgments.1.case_no");
  await expect(page.getByTestId("sel-label")).toHaveText("JGMT 1 — CASE NO");
  await expect(page.getByTestId("sel-state")).toContainText(
    "PRESENT — UNREADABLE",
  );
});

test("seed correction without context shows the no-menu-entry state", async ({
  page,
}) => {
  await page.goto("/seed-correction");
  const empty = page.getByTestId("no-context");
  await expect(empty).toContainText("This screen has no menu entry.");
  await expect(empty).toContainText("Investigate seed");
  // and no picker exists — one field, one document, one record
  await expect(page.getByTestId("seed-correct-btn")).toHaveCount(0);
});

test("bench results carries context into seed correction", async ({ page }) => {
  await page.goto("/bench/results");
  await page.getByTestId("fail-mortgages.1.amount").click();
  await page.getByText("Investigate seed →").click();
  await expect(page).toHaveURL(/\/seed-correction\?.*fieldId=gf_1/);
  await expect(page.getByTestId("seed-value")).toHaveText("$202,224.00");
});

test("the order spine travels with the order on Review", async ({ page }) => {
  await page.goto("/orders/ord_demo_1/review");
  const rail = page.getByTestId("order-rail");
  await expect(rail).toContainText("ord_demo_1");
  await expect(rail).toContainText("still queued");
  await expect(rail).toContainText("escalations open"); // esc cluster spans this order
  await expect(rail).toContainText("delivered v1");
});
