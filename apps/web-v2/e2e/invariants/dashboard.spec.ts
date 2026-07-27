import { expect, test } from "@playwright/test";

/**
 * HARVESTED INVARIANTS — migrated from apps/web @ ade49af (pre-rebuild).
 * Source: apps/web/e2e/dashboard.spec.ts
 *
 * Every test here is SKIPPED until the feature it covers lands in web-v2.
 * Un-skip as each feature lands. Rewrite selectors freely.
 * NEVER weaken an assertion — if one cannot pass against the new design,
 * that is a CONFLICT in the design: stop and report (BRIEF §5 Phase 5).
 */

// TODO(rebuild) [INVARIANT] — rule: §4.5 — catch_rate is the headline and always carries its denominator.
test.skip("catch rate is the headline, with its denominator", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByTestId("catch-rate")).toHaveText("71%");
  await expect(page.getByText("n = 34 probes this week · 24 caught")).toBeVisible();
});

// TODO(rebuild) [INVARIANT] — rule: no aggregate accuracy figure, no probe visibility, no per-reviewer anything, no ranking.
test.skip("no aggregate accuracy, no probe details, no reviewer names", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page.getByTestId("catch-rate")).toBeVisible();
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).not.toMatch(/\baccuracy\b/);
  expect(body).not.toContain("planted)"); // no probe rows, only the count
  expect(body).not.toContain("okafor"); // no per-reviewer anything
  expect(body).not.toContain("rank");
});

// TODO(rebuild) [INVARIANT] — rule: drill-downs are server-authored — the client does not compute the history.
test.skip("a backlog row opens its server-authored drill-down", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByTestId("backlog-judgments.1.plaintiff_attorney").click();
  const drawer = page.getByTestId("drill-drawer");
  await expect(drawer).toContainText(
    "judgments.1.plaintiff_attorney — REVIEW HISTORY",
  );
  await expect(drawer).toContainText("corrected ×25");
  await drawer.getByRole("button", { name: "×" }).click();
  await expect(drawer).toHaveCount(0);
});

// TODO(rebuild) [INVARIANT] — rule: ORPHAN — a correction on a DERIVED field reads as one upstream bug, not as N independent defects.
test.skip("derived-source corrections read as upstream bugs", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByText("SHOULD BE IMPOSSIBLE", { exact: false }).first().click();
  await expect(page.getByTestId("drill-drawer")).toContainText(
    "one broken function, not two defects",
  );
});
