import { expect, test } from "@playwright/test";

/**
 * Rule: a screen's keys are pane-local. A key belongs to exactly one layer
 * at a time, and the innermost layer that can use it wins: when a control
 * has focus, the control owns the keystroke — the screen's shortcut stands
 * down and does not suppress the default. This matters most on the queue,
 * where the rail's doors are anchors and taking an order is a
 * work-assignment act, not navigation. The body-focus case — Enter with
 * nothing focused takes the served order — is pinned by `queue.spec` #5 and
 * stays true; these tests bound it, they do not replace it.
 */

test("Enter on a rail door opens THAT door, never the served order", async ({
  page,
}) => {
  await page.goto("/queue");
  await expect(page.getByTestId("order-ref")).toBeVisible();
  await page.getByTestId("rail-door-/overview").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/overview/);
});

test("Enter on the focused rail toggle folds the navigator", async ({ page }) => {
  await page.goto("/queue");
  await expect(page.getByTestId("order-ref")).toBeVisible();
  const rail = page.getByTestId("side-rail");
  await expect(rail).toHaveAttribute("data-collapsed", "0");
  await page.getByTestId("rail-toggle").focus();
  await page.keyboard.press("Enter");
  await expect(rail).toHaveAttribute("data-collapsed", "1");
  await expect(page).toHaveURL(/\/queue$/);
});

test("Enter on the pass button opens the reason, never review", async ({ page }) => {
  await page.goto("/queue");
  await expect(page.getByTestId("order-ref")).toBeVisible();
  await page.getByRole("button", { name: /Pass/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByPlaceholder(/why are you passing/)).toBeVisible();
  await expect(page).toHaveURL(/\/queue$/);
});

// The `p` binding carries the same defect as Enter and is fixed by the same
// guard: while a control holds focus, the queue's letter keys stand down too.
test("p while a control holds focus is the control's key, not the pass shortcut", async ({
  page,
}) => {
  await page.goto("/queue");
  await expect(page.getByTestId("order-ref")).toBeVisible();
  await page.getByTestId("rail-toggle").focus();
  await page.keyboard.press("p");
  await expect(page.getByPlaceholder(/why are you passing/)).toHaveCount(0);
});
