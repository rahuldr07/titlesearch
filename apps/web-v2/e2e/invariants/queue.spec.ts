import { expect, test } from "@playwright/test";

/**
 * HARVESTED INVARIANTS — migrated from apps/web @ ade49af (pre-rebuild).
 * Source: apps/web/e2e/queue.spec.ts
 *
 * Every test here is SKIPPED until the feature it covers lands in web-v2.
 * Un-skip as each feature lands. Rewrite selectors freely.
 * NEVER weaken an assertion — if one cannot pass against the new design,
 * that is a CONFLICT in the design: stop and report (BRIEF §5 Phase 5).
 */

// TODO(rebuild) [INVARIANT] — rule: the queue is a single server-chosen next order — no list, no browsing, no cherry-picking.
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

// TODO(rebuild) [INVARIANT] — rule: no pace indicators, no throughput language, and no time ESTIMATES — an estimate is a pace indicator.
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

// TODO(rebuild) [ORPHAN RULE] — rule: a pass is refused without its reason, and escape keeps the order.
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

// TODO(rebuild) [INVARIANT] — rule: a reasoned pass records and the server serves the next order.
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

// TODO(rebuild) [INVARIANT] — rule: ORPHAN — Enter starts review on the SERVED order. (Promoted to INVARIANT by open-rulings Q3.)
test("enter starts review on the served order", async ({ page }) => {
  await page.goto("/queue");
  await expect(page.getByTestId("order-ref")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/orders\/ord_demo_1\/review/);
});
