import { expect, test, type Page } from "@playwright/test";

/**
 * Escalation invariants. Never weaken an assertion — a test that cannot
 * pass against the new design is a conflict in the design: stop and report.
 */

// Rule: escalation resolution is refused without a rule. A ruling alone is not a resolution.
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
  await page.getByTestId("mode-draft").click();
  await expect(btn).toBeDisabled();
});

// Rule: citing an existing rule is one of exactly two resolution paths.
test("citing an existing rule resolves the cluster", async ({ page }) => {
  await page.goto("/escalations");
  await page
    .getByTestId("ruling-input")
    .fill("A hit is ours when name + county match during our grantor's ownership.");
  await citeRule(page, "R13");
  const btn = page.getByTestId("resolve-btn");
  await expect(btn).toBeEnabled();
  await btn.click();
  await expect(page.getByText("✓ Rule written — cluster cleared.")).toBeVisible();
  await expect(page.getByText("LIVE IN PIPELINE — R13").first()).toBeVisible();
});

// Rule: a drafted rule lands PENDING and renders visibly inert — it cannot affect the pipeline until an engineer confirms.
test("a drafted rule lands PENDING and renders visibly inert", async ({ page }) => {
  await page.goto("/escalations");
  await page.locator('[data-cluster="liens.hoa_age"]').first().click();
  await page.getByTestId("ruling-input").fill("Age alone never drops an HOA lien.");
  await page.getByTestId("mode-draft").click();
  await page
    .getByTestId("draft-input")
    .fill("HOA liens report regardless of age unless cancelled of record.");
  await page.getByTestId("resolve-btn").click();
  await expect(
    page
      .getByText(/PENDING — CANNOT AFFECT THE PIPELINE UNTIL AN ENGINEER CONFIRMS/)
      .first(),
  ).toBeVisible();
});

// Rule (recorded nowhere else): the escalation inbox has no triage furniture — no category, no priority, no assignee. Just the rule.
test("no priority, category, or assignee affordances exist", async ({ page }) => {
  await page.goto("/escalations");
  // the only controls on the resolve card are the ruling, the rule choice,
  // and the cite/draft inputs — nothing to triage with
  await expect(page.getByRole("combobox")).toHaveCount(1); // the rule citation only
  await expect(
    page.getByText("no category, no priority, no assignee — just the rule"),
  ).toBeVisible();
});

/**
 * The determination for a non-QC seat is visible + disabled under the amber
 * "belongs to QC" hint. The rail door stays absent for a role without
 * `screen.escalations.enter`, and the server refusal (403 on resolve) is
 * untouched — the dimmed button is a courtesy, never the enforcement
 * (authz.spec covers the wire refusal).
 */
test("the determination is visible + disabled for a non-QC seat (RULING-2026-08-29)", async ({
  page,
}) => {
  await page.goto("/escalations");
  await expect(page.getByTestId("resolve-card")).toBeVisible();

  /*
   * No `page.goto` after the switch: the demo session is a non-persisted
   * zustand store, so a full page load re-boots it to the dev-default admin.
   */
  await page.getByTestId("sign-out").click();
  await page.getByTestId("continue-as-reviewer").click();
  // Continue-as lands on "/" — walk BACK to /escalations through SPA history
  // (a page.goto would reload and re-boot the session store to admin).
  await page.goBack();

  // the rail still carries no escalations door for a reviewer…
  await expect(page.getByTestId("side-rail")).toBeVisible();
  await expect(page.getByRole("link", { name: "Escalations" })).toHaveCount(0);

  // …but the screen (still mounted) now draws the determination the way the
  // reference draws it: visible, disabled, and saying whose it is.
  await expect(page.getByTestId("determination-belongs-to-qc")).toContainText(
    "belongs to QC",
  );
  const locked = page.getByTestId("resolve-btn-locked");
  await expect(locked).toBeVisible();
  await expect(locked).toBeDisabled();
});

/**
 * The evidence surfaces: the docket excerpt (on paper, boxed at the match,
 * with its View-on-page jump) and the debtor-vs-owner identity grid are
 * served on the escalation and drawn.
 */
test("the docket excerpt and identity grid render as drawn", async ({ page }) => {
  await page.goto("/escalations");
  const excerpt = page.getByTestId("docket-excerpt");
  await expect(excerpt).toBeVisible();
  await expect(excerpt).toContainText("SMITH, JOHN A.");
  await expect(page.getByTestId("excerpt-view-on-page")).toBeVisible();
  const grid = page.getByTestId("identity-grid");
  await expect(grid).toContainText("Judgment debtor of record");
  await expect(grid).toContainText("Vested owner of subject parcel");
});

/** Choose a rule from the rulebook ComboBox by its code. */
async function citeRule(page: Page, code: string): Promise<void> {
  await page.getByTestId("cite-select").getByRole("combobox").fill(code);
  await page.getByRole("option", { name: new RegExp(`^${code} `) }).click();
}
