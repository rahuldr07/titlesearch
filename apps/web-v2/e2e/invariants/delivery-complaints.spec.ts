import { expect, test } from "@playwright/test";

/**
 * HARVESTED INVARIANTS — migrated from apps/web @ ade49af (pre-rebuild).
 * Source: apps/web/e2e/delivery-complaints.spec.ts
 *
 * Every test here is SKIPPED until the feature it covers lands in web-v2.
 * Un-skip as each feature lands. Rewrite selectors freely.
 * NEVER weaken an assertion — if one cannot pass against the new design,
 * that is a CONFLICT in the design: stop and report (BRIEF §5 Phase 5).
 */

// TODO(rebuild) [INVARIANT] — rule: §4.7 — a failed delivery is a TRANSIT problem (attend), never a quality problem (act), and offers retry.
test.skip("a failed delivery reads as transit, offers retry, and retry delivers", async ({
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

// TODO(rebuild) [INVARIANT] — rule: every delivered version stays listed — the version list IS the defect record.
test.skip("both report versions list as the defect record", async ({ page }) => {
  await page.goto("/delivery");
  const card = page.getByTestId("delivery-ord_demo_3");
  await expect(card.getByTestId("delivery-status")).toHaveText(
    "DELIVERED · 2 VERSIONS",
  );
  await expect(card).toContainText("v1");
  await expect(card).toContainText("v2");
  await expect(card).toContainText("defect record");
});

// TODO(rebuild) [INVARIANT] — rule: §4.8 — complaints group by how_it_got_through, and auto_confirmed is visually distinct because no human saw it. No per-reviewer complaint counts exist.
test.skip("complaints group by how it got through; auto-confirmed is distinct", async ({
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

// TODO(rebuild) [INVARIANT] — rule: complaint capture is per-field and refused until filled.
test.skip("per-field capture records into its group", async ({ page }) => {
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

// TODO(rebuild) [INVARIANT] — rule: a complaint resolution is refused without a rule — a fix alone is not a resolution.
test.skip("resolving a complaint is refused without a rule; a draft rule files it", async ({
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
