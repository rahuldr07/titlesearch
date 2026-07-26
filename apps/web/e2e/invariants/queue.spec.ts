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
 * Queue refusals + forbidden-pattern invariants (frontend-master-prompt §0.4,
 * §4.1). The queue is a single next-order card: no browsing, no counts, no
 * pace. Pass requires a reason.
 */

// TODO(rebuild): un-skip when this feature lands — rule: renders the server's next order verbatim — exactly one order, no list
test.skip("renders the server's next order verbatim — exactly one order, no list", async ({
  page,
}) => {
  await page.goto("/queue");
  const refs = page.getByTestId("order-ref");
  await expect(refs).toHaveCount(1);
  await expect(refs).toHaveText("DEMO-0001");
  // No queue browsing: the second queued order is not on the page anywhere.
  await expect(page.getByText("DEMO-0002")).toHaveCount(0);
});

// TODO(rebuild): un-skip when this feature lands — rule: no pace indicators or throughput language renders
test.skip("no pace indicators or throughput language renders", async ({ page }) => {
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

// TODO(rebuild): un-skip when this feature lands — rule: pass without a reason is refused; esc keeps the order
test.skip("pass without a reason is refused; esc keeps the order", async ({
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

// TODO(rebuild): un-skip when this feature lands — rule: pass with a reason records and advances to the next order
test.skip("pass with a reason records and advances to the next order", async ({
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

// TODO(rebuild): un-skip when this feature lands — rule: enter starts review on the served order
test.skip("enter starts review on the served order", async ({ page }) => {
  await page.goto("/queue");
  await expect(page.getByTestId("order-ref")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/orders\/ord_demo_1\/review/);
});
