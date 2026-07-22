import { expect, test } from "@playwright/test";

/**
 * Delivery (§4.7): failed = transit (attend), never quality (act); v1+v2
 * both listed. Complaints (§4.8): per-field capture; grouped by
 * how_it_got_through; auto_confirmed visually distinct.
 */

test("a failed delivery reads as transit, offers retry, and retry delivers", async ({
  page,
}) => {
  await page.goto("/delivery");
  const card = page.getByTestId("delivery-ord_demo_2");
  await expect(card.getByTestId("delivery-status")).toHaveText(
    "FAILED IN TRANSIT",
  );
  await expect(card).toContainText("not a quality problem");
  await card.getByTestId("retry-btn").click();
  await expect(card.getByTestId("delivery-status")).toHaveText("DELIVERED");
});

test("both report versions list as the defect record", async ({ page }) => {
  await page.goto("/delivery");
  const card = page.getByTestId("delivery-ord_demo_3");
  await expect(card.getByTestId("delivery-status")).toHaveText(
    "DELIVERED · 2 VERSIONS",
  );
  await expect(card).toContainText("v1");
  await expect(card).toContainText("v2");
  await expect(card).toContainText("defect record");
});

test("complaints group by how it got through; auto-confirmed is distinct", async ({
  page,
}) => {
  await page.goto("/complaints");
  await expect(page.getByTestId("group-auto_confirmed")).toHaveText(
    "AUTO-CONFIRMED — NO HUMAN SAW IT",
  );
  await expect(
    page.getByTestId("complaint-cmp_1"),
  ).toContainText("no human ever saw it");
  // no per-reviewer complaint counts, ever
  await expect(
    page.getByText("No per-reviewer complaint counts exist here"),
  ).toBeVisible();
});

test("per-field capture records into its group", async ({ page }) => {
  await page.goto("/complaints");
  await page.getByTestId("cap-deed.consideration").click();
  const record = page.getByTestId("cap-record");
  await expect(record).toBeDisabled(); // nothing filled yet
  await page.getByTestId("cap-should").fill("$215,500.00");
  await page
    .getByTestId("cap-words")
    .fill("the HUD shows 215,500 — your report says 215,000");
  await record.click();
  await expect(
    page.getByTestId("complaint-cmp_new_1"),
  ).toContainText("client says");
});

test("resolving a complaint is refused without a rule; a draft rule files it", async ({
  page,
}) => {
  await page.goto("/complaints");
  await page.getByTestId("resolve-open-cmp_1").click();
  const btn = page.getByTestId("cmp-resolve-btn-cmp_1");
  await expect(btn).toBeDisabled(); // no fix, no rule
  await page
    .getByTestId("cmp-resolution-cmp_1")
    .fill("v2 re-delivered with the delinquent city tax restored");
  await expect(btn).toBeDisabled(); // fix alone is not a resolution — a rule is required
  await page.getByTestId("cmp-mode-draft-cmp_1").check();
  await page
    .getByTestId("cmp-draft-input-cmp_1")
    .fill("delinquent city-tax lines are always surfaced, never auto-confirmed");
  await expect(btn).toBeEnabled();
  await page.getByTestId("cmp-golden-offer-cmp_1").check();
  await btn.click();
  const resolved = page.getByTestId("complaint-resolved-cmp_1");
  await expect(resolved).toContainText("resolved");
  await expect(resolved).toContainText("GOLDEN CASE");
});
