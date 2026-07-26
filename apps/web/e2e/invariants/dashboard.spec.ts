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
 * Readout invariants (frontend-master-prompt §4.5/§4.6 + §0.4): catch_rate
 * is the headline; no aggregate accuracy; no probe details; no per-reviewer
 * anything; drill-downs are server-authored.
 */

// TODO(rebuild): un-skip when this feature lands — rule: catch rate is the headline, with its denominator
test.skip("catch rate is the headline, with its denominator", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByTestId("catch-rate")).toHaveText("71%");
  await expect(page.getByText("n = 34 probes this week · 24 caught")).toBeVisible();
});

// TODO(rebuild): un-skip when this feature lands — rule: no aggregate accuracy, no probe details, no reviewer names
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

// TODO(rebuild): un-skip when this feature lands — rule: a backlog row opens its server-authored drill-down
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

// TODO(rebuild): un-skip when this feature lands — rule: derived-source corrections read as upstream bugs
test.skip("derived-source corrections read as upstream bugs", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByText("SHOULD BE IMPOSSIBLE", { exact: false }).first().click();
  await expect(page.getByTestId("drill-drawer")).toContainText(
    "one broken function, not two defects",
  );
});
