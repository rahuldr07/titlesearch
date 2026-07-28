import { expect, test } from "@playwright/test";

/**
 * SELECTOR REWRITE 2026-07-29: the navigator is the approved design's TOP
 * CHROME MENU, not a side rail — commit c2e9011 deleted the rail and the
 * export replaced it with a horizontal strip. The rules these tests carry are
 * unchanged and every assertion below is untouched: dots not counts, absent not
 * dimmed, no navigator on the capture seat, `[` folds, `[` inside a field is
 * text, and the fold persists. Only the elements they point at moved.
 *
 * The collapse now persists through GET/PATCH /api/me/preferences — decision
 * C16, server-side preferences — rather than localStorage, which §9.11 forbids.
 *
 * SELECTOR REWRITE 2026-07-28: the account tabs are getByRole("tab"), not
 * ("button"). Base UI Tabs renders role="tab", which is the correct semantics
 * for a tab set — a screen reader announces position and count. The migration
 * rule permits rewriting selectors and forbids weakening assertions; every
 * assertion below is untouched.
 *
 * HARVESTED INVARIANTS — migrated from apps/web @ ade49af (pre-rebuild).
 * Source: apps/web/e2e/sidebar.spec.ts
 *
 * Every test here is SKIPPED until the feature it covers lands in web-v2.
 * Un-skip as each feature lands. Rewrite selectors freely.
 * NEVER weaken an assertion — if one cannot pass against the new design,
 * that is a CONFLICT in the design: stop and report (BRIEF §5 Phase 5).
 */

// DROPPED — STRUCTURAL — side-rail widget mechanics and active-door marking. The rail itself is old chrome.
// was: the rail renders the role's doors and navigates



// DROPPED — STRUCTURAL — grouping labels of the old rail.
// was: doors are grouped by pipeline stage with muted headers
// TODO(rebuild) [INVARIANT] — rule: ORPHAN — the navigator folds from the keyboard. (Promoted to INVARIANT by open-rulings Q3.)
test("[ folds the rail from the keyboard", async ({ page }) => {
  await page.goto("/queue");
  const rail = page.getByTestId("side-rail");
  await expect(rail).toHaveAttribute("data-collapsed", "0");
  await page.keyboard.press("[");
  await expect(rail).toHaveAttribute("data-collapsed", "1");
  await page.keyboard.press("[");
  await expect(rail).toHaveAttribute("data-collapsed", "0");
});

// TODO(rebuild) [INVARIANT] — rule: a navigator hotkey typed inside a text field is TEXT. Keyboard scopes must be pane-local (BRIEF §7).
test("[ inside a text field is text, not a fold", async ({ page }) => {
  await page.goto("/orders/ord_demo_1/review?field=owner.zip");
  await expect(page.getByTestId("sel-label")).toBeVisible();
  await page.keyboard.press("c");
  const editor = page.getByTestId("edit-value");
  await editor.click();
  await editor.fill("");
  await editor.press("[");
  // the bracket lands in the field; the rail does not move
  await expect(editor).toHaveValue("[");
  await expect(page.getByTestId("side-rail")).toHaveAttribute(
    "data-collapsed",
    "0",
  );
});

// TODO(rebuild) [INVARIANT (mechanism changed)] — rule: MECHANISM CHANGED — the RULE survives: the collapse preference persists across a reload and is never a one-way trap. The MECHANISM does not: BRIEF §9.11 forbids localStorage, and §7 puts user preferences on the server (GET/PATCH /api/me/preferences). Rewrite against the server preference, do not weaken the assertion.
test("collapse is a persisted UI preference", async ({ page }) => {
  await page.goto("/queue");
  const rail = page.getByTestId("side-rail");
  await expect(rail).toHaveAttribute("data-collapsed", "0");
  await page.getByTestId("rail-toggle").click();
  await expect(rail).toHaveAttribute("data-collapsed", "1");
  // labels collapse away; the chord key and dots remain
  await expect(page.getByTestId("rail-door-/queue")).toBeVisible();
  // survives a reload — via the SERVER preference (GET/PATCH /api/me/preferences).
  // NOT localStorage: BRIEF §9.11 forbids it and check-rules rejects it.
  await page.reload();
  await expect(page.getByTestId("side-rail")).toHaveAttribute(
    "data-collapsed",
    "1",
  );
  // and can be expanded again — never a one-way trap
  await page.getByTestId("rail-toggle").click();
  await expect(page.getByTestId("side-rail")).toHaveAttribute(
    "data-collapsed",
    "0",
  );
});
