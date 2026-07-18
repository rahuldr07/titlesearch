import { expect, test } from "@playwright/test";

/**
 * The mandatory §0.5 refusal: escalation resolution is REFUSED without a
 * rule (cite existing OR draft new → lands PENDING, visibly inert).
 */

test("resolve stays held without a ruling AND a rule", async ({ page }) => {
  await page.goto("/escalations");
  const btn = page.getByTestId("resolve-btn");
  await expect(btn).toBeDisabled();
  await expect(btn).toContainText("held");
  // ruling alone is not enough — the rule is the resolution
  await page
    .getByTestId("ruling-input")
    .fill("Dismissed cases stay off; middle-initial-only is a match.");
  await expect(btn).toBeDisabled();
  // picking draft mode with an empty draft is still refused
  await page.getByTestId("mode-draft").check();
  await expect(btn).toBeDisabled();
});

test("citing an existing rule resolves the cluster", async ({ page }) => {
  await page.goto("/escalations");
  await page
    .getByTestId("ruling-input")
    .fill("A hit is ours when name + county match during our grantor's ownership.");
  await page.getByTestId("cite-select").selectOption({ index: 1 });
  const btn = page.getByTestId("resolve-btn");
  await expect(btn).toBeEnabled();
  await btn.click();
  await expect(page.getByText("✓ Rule written — cluster cleared.")).toBeVisible();
  await expect(page.getByText("LIVE IN PIPELINE — R13").first()).toBeVisible();
});

test("a drafted rule lands PENDING and renders visibly inert", async ({
  page,
}) => {
  await page.goto("/escalations");
  await page.getByTestId("cluster-liens.hoa_age").click();
  await page
    .getByTestId("ruling-input")
    .fill("Age alone never drops an HOA lien.");
  await page.getByTestId("mode-draft").check();
  await page
    .getByTestId("draft-input")
    .fill("HOA liens report regardless of age unless cancelled of record.");
  await page.getByTestId("resolve-btn").click();
  await expect(
    page.getByText(/PENDING — CANNOT AFFECT THE PIPELINE UNTIL AN ENGINEER CONFIRMS/).first(),
  ).toBeVisible();
});

test("no priority, category, or assignee affordances exist", async ({
  page,
}) => {
  await page.goto("/escalations");
  // the only controls on the resolve card are the ruling, the rule choice,
  // and the cite/draft inputs — nothing to triage with
  await expect(page.getByRole("combobox")).toHaveCount(1); // the rule citation only
  await expect(
    page.getByText("no category, no priority, no assignee — just the rule"),
  ).toBeVisible();
});
