import { expect, test } from "@playwright/test";

/**
 * Queue invariants. Never weaken an assertion — a test that cannot pass
 * against the new design is a conflict in the design: stop and report.
 */

// Rule: the queue is a single server-chosen next order — no list, no browsing, no cherry-picking.
test("renders the server's next order verbatim — exactly one order, no list", async ({
  page,
}) => {
  await page.goto("/queue");
  const refs = page.getByTestId("order-ref");
  await expect(refs).toHaveCount(1);
  await expect(refs).toHaveText("4176034-1");
  // No queue browsing: the second queued order is not on the page anywhere.
  await expect(page.getByText("4176052-7")).toHaveCount(0);
});

// Rule: no pace indicators, no throughput language, and no time ESTIMATES — an estimate is a pace indicator.
test("no pace indicators or throughput language renders", async ({ page }) => {
  await page.goto("/queue");
  await expect(page.getByTestId("order-ref")).toBeVisible();
  const body = (await page.locator("body").innerText()).toLowerCase();
  for (const forbidden of ["min/order", "per hour", "throughput", "rank"]) {
    expect(body).not.toContain(forbidden);
  }
  // Time *estimates* are pace indicators too.
  expect(body).not.toContain("last one like it");
});

// Rule (recorded nowhere else): a pass is refused without its reason, and escape keeps the order.
test("pass without a reason is refused; esc keeps the order", async ({ page }) => {
  await page.goto("/queue");
  await expect(page.getByTestId("order-ref")).toHaveText("4176034-1");
  await page.keyboard.press("p");
  const input = page.getByPlaceholder(/why are you passing/);
  await expect(input).toBeFocused();
  await input.press("Enter"); // empty — must not submit
  await expect(page.getByTestId("passed-note")).toHaveCount(0);
  await expect(page.getByTestId("order-ref")).toHaveText("4176034-1");
  await input.press("Escape");
  await expect(input).toHaveCount(0);
});

// Rule: a reasoned pass records and the server serves the next order.
test("pass with a reason records and advances to the next order", async ({ page }) => {
  await page.goto("/queue");
  await expect(page.getByTestId("order-ref")).toHaveText("4176034-1");
  await page.keyboard.press("p");
  const input = page.getByPlaceholder(/why are you passing/);
  await input.fill("never done a Cobb Co. tax card");
  await input.press("Enter");
  await expect(page.getByTestId("passed-note")).toContainText("passed 4176034-1");
  await expect(page.getByTestId("order-ref")).toHaveText("4176052-7");
});

// Rule (recorded nowhere else): Enter starts review on the SERVED order.
test("enter starts review on the served order", async ({ page }) => {
  await page.goto("/queue");
  await expect(page.getByTestId("order-ref")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/orders\/ord_demo_1\/review/);
});
