import { expect, test } from "@playwright/test";

/**
 * Readout invariants (frontend-master-prompt §4.5/§4.6 + §0.4): catch_rate
 * is the headline; no aggregate accuracy; no probe details; no per-reviewer
 * anything; drill-downs are server-authored.
 */

test("catch rate is the headline, with its denominator", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByTestId("catch-rate")).toHaveText("71%");
  await expect(page.getByText("n = 34 probes this week · 24 caught")).toBeVisible();
});

test("no aggregate accuracy, no probe details, no reviewer names", async ({
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

test("a backlog row opens its server-authored drill-down", async ({ page }) => {
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

test("derived-source corrections read as upstream bugs", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByText("SHOULD BE IMPOSSIBLE", { exact: false }).first().click();
  await expect(page.getByTestId("drill-drawer")).toContainText(
    "one broken function, not two defects",
  );
});
