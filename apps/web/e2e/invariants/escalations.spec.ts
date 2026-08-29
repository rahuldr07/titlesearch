import { expect, test, type Page } from "@playwright/test";

/**
 * HARVESTED INVARIANTS — migrated from apps/web @ ade49af (pre-rebuild).
 * Source: apps/web/e2e/escalations.spec.ts
 *
 * UN-SKIPPED 2026-08-27 as screen 10 landed. Every assertion below is the
 * pre-rebuild one; only selectors moved, which the migration rule permits and
 * the un-skip required:
 *
 *   - `cite-select` was a native `<select>` and `selectOption({index:1})`. The
 *     rule catalog is now a ComboBox (react-aria), because the rulebook is
 *     searched rather than scrolled — so the rule is CHOSEN BY ITS CODE
 *     instead of by list position. That strengthens test 2: the old index
 *     assertion would have passed against any rule, and the trailing
 *     `LIVE IN PIPELINE — R13` assertion is now genuinely about R13.
 *   - `cluster-liens.hoa_age` is `[data-cluster="liens.hoa_age"]` — the
 *     cluster path is a data attribute on the queue row rather than baked into
 *     a testid.
 *
 * NEVER weaken an assertion — if one cannot pass against the new design,
 * that is a CONFLICT in the design: stop and report (BRIEF §5 Phase 5).
 */

// [INVARIANT] — rule: §0.5 MANDATORY — escalation resolution is REFUSED without a rule. A ruling alone is not a resolution.
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

// [INVARIANT] — rule: citing an existing rule is one of exactly two resolution paths.
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

// [INVARIANT] — rule: a drafted rule lands PENDING and renders visibly inert — it cannot affect the pipeline until an engineer confirms.
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

// [ORPHAN RULE] — rule: the escalation inbox has no triage furniture — no category, no priority, no assignee. Just the rule.
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
 * THE CONTRACT WINS OVER THE DESIGN, AND THIS IS THE ASSERTION OF IT.
 *
 * Design §Screens 10 wants determination buttons "disabled + 'belongs to QC'"
 * for roles that lack them. `INVARIANTS:42-43` says a role-locked affordance is
 * ABSENT, not disabled, and the contract's permission projection makes it so:
 * a role without the grant never receives it, so there is nothing to dim.
 *
 * WHAT THIS TEST ASSERTS, AND WHY IT IS THE DOOR RATHER THAN THE BUTTON.
 * `screen.escalations.enter` (authz.ts:68) and `escalation.resolve`
 * (authz.ts:104) hold the SAME role set — `senior`/`admin`. So no role exists
 * that can stand on this screen and not hold the determination, and a test
 * driving one would be testing a state the permission table cannot produce.
 * The absence therefore asserts at the outer boundary, which is where the
 * contract actually puts it. The screen's inner guard stays regardless: the two
 * grants are separate rows and may diverge, and a screen that relied on them
 * coinciding would ship the design's dimmed button the day they did.
 *
 * NEW, not harvested — the collision is new, so nothing pre-rebuild covers it.
 */
test("the escalations door is ABSENT for a role that does not hold it", async ({ page }) => {
  await page.goto("/escalations");
  await expect(page.getByTestId("resolve-card")).toBeVisible();

  /*
   * NO `page.goto` AFTER THE SWITCH. The demo session is a zustand store that
   * §9.11 forbids persisting, so a full page load re-boots it to the
   * dev-default ADMIN (`signedIn.ts`). The first write of this test reloaded
   * and asserted against an admin while believing it had a reviewer.
   */
  await page.getByTestId("sign-out").click();
  await page.getByTestId("continue-as-reviewer").click();

  // absent, not dimmed — the rail carries no escalations door at all
  await expect(page.getByTestId("side-rail")).toBeVisible();
  await expect(page.getByRole("link", { name: "Escalations" })).toHaveCount(0);
});

/** Choose a rule from the rulebook ComboBox by its code. */
async function citeRule(page: Page, code: string): Promise<void> {
  await page.getByTestId("cite-select").getByRole("combobox").fill(code);
  await page.getByRole("option", { name: new RegExp(`^${code} `) }).click();
}
