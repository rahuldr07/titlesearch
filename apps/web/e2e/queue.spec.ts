import { expect, test } from "@playwright/test";

/**
 * Queue refusals + forbidden-pattern invariants (frontend-master-prompt §0.4,
 * §4.1). The queue is a single next-order card: no browsing, no counts, no
 * pace. Pass requires a reason.
 */

test("renders the server's next order verbatim — exactly one order, no list", async ({
  page,
}) => {
  await page.goto("/queue");
  const refs = page.getByTestId("order-ref");
  await expect(refs).toHaveCount(1);
  await expect(refs).toHaveText("DEMO-0001");
  // No queue browsing: the second queued order is not on the page anywhere.
  await expect(page.getByText("DEMO-0002")).toHaveCount(0);
});

test("no pace indicators or throughput language renders", async ({ page }) => {
  await page.goto("/queue");
  await expect(page.getByTestId("order-ref")).toBeVisible();
  const body = (await page.locator("body").innerText()).toLowerCase();
  for (const forbidden of ["min/order", "per hour", "throughput", "rank"]) {
    expect(body).not.toContain(forbidden);
  }
  // Time *estimates* are pace indicators (§0.4) — the est copy from the
  // prototype must not have been ported.
  expect(body).not.toContain("last one like it");
});

test("pass without a reason is refused; esc keeps the order", async ({
  page,
}) => {
  await page.goto("/queue");
  await expect(page.getByTestId("order-ref")).toHaveText("DEMO-0001");
  await page.keyboard.press("p");
  const input = page.getByPlaceholder(/why are you passing/);
  await expect(input).toBeFocused();
  await input.press("Enter"); // empty — must not submit
  await expect(page.getByTestId("passed-note")).toHaveCount(0);
  await expect(page.getByTestId("order-ref")).toHaveText("DEMO-0001");
  await input.press("Escape");
  await expect(input).toHaveCount(0);
});

test("pass with a reason records and advances to the next order", async ({
  page,
}) => {
  await page.goto("/queue");
  await expect(page.getByTestId("order-ref")).toHaveText("DEMO-0001");
  await page.keyboard.press("p");
  const input = page.getByPlaceholder(/why are you passing/);
  await input.fill("never done a Cobb Co. tax card");
  await input.press("Enter");
  await expect(page.getByTestId("passed-note")).toContainText(
    "passed DEMO-0001",
  );
  await expect(page.getByTestId("order-ref")).toHaveText("DEMO-0002");
});

test("enter starts review on the served order", async ({ page }) => {
  await page.goto("/queue");
  await expect(page.getByTestId("order-ref")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/orders\/ord_demo_1\/review/);
});
