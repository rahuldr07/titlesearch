import { expect, test } from "@playwright/test";

/**
 * HARVESTED INVARIANTS — migrated from apps/web @ ade49af (pre-rebuild).
 * Source: apps/web/e2e/escalations.spec.ts
 *
 * Every test here is SKIPPED until the feature it covers lands in web-v2.
 * Un-skip as each feature lands. Rewrite selectors freely.
 * NEVER weaken an assertion — if one cannot pass against the new design,
 * that is a CONFLICT in the design: stop and report (BRIEF §5 Phase 5).
 */

// TODO(rebuild) [INVARIANT] — rule: §0.5 MANDATORY — escalation resolution is REFUSED without a rule. A ruling alone is not a resolution.
test.skip("resolve stays held without a ruling AND a rule", async ({ page }) => {
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

// TODO(rebuild) [INVARIANT] — rule: citing an existing rule is one of exactly two resolution paths.
test.skip("citing an existing rule resolves the cluster", async ({ page }) => {
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

// TODO(rebuild) [INVARIANT] — rule: a drafted rule lands PENDING and renders visibly inert — it cannot affect the pipeline until an engineer confirms.
test.skip("a drafted rule lands PENDING and renders visibly inert", async ({
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

// TODO(rebuild) [ORPHAN RULE] — rule: the escalation inbox has no triage furniture — no category, no priority, no assignee. Just the rule.
test.skip("no priority, category, or assignee affordances exist", async ({
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
