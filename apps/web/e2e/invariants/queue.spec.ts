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

// UN-SKIPPED 2026-07-27 (Pass 3). rule: GET /api/queue/next serves ONE order and the queue is not browsable — Next up is the only section with data (ruling Q12 still open for the rest)
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

// UN-SKIPPED 2026-07-27 (Pass 3). rule: no pace, no throughput, no time estimates — the only clock on the screen is the order's own arrival time
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

// UN-SKIPPED 2026-07-27 (Pass 3). rule: orphan O1 — a pass costs a reason; the refusal is structural (RequiredComment) and Escape leaves the order where it was
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

// UN-SKIPPED 2026-07-27 (Pass 3). rule: the pass is recorded and the SERVER re-picks — the screen re-asks /api/queue/next rather than advancing a cursor of its own
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

// UN-SKIPPED 2026-07-27 (Pass 3). rule: keyboard-first (Q3) — ⏎ takes the order the server served, never one the reviewer chose
test("enter starts review on the served order", async ({ page }) => {
  await page.goto("/queue");
  await expect(page.getByTestId("order-ref")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/orders\/ord_demo_1\/review/);
});
