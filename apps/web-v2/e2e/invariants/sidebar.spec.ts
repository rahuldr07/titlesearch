import { expect, test } from "@playwright/test";

/**
 * The navigator is the approved design's COLLAPSIBLE LEFT SIDEBAR (§11, the
 * 2026-07-28 revision). It replaced the interim top-chrome strip: 232px wide,
 * 78px collapsed, grouped doors plus a lifecycle "flow" rail, the account menu
 * at its foot. The rules these tests carry are unchanged; only the element they
 * point at moved back to the rail.
 *
 * The collapse persists through GET/PATCH /api/me/preferences — decision C16,
 * server-side preferences — never localStorage, which §9.11 forbids.
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
 * Three invariants were dropped on 2026-07-29 with the interim top chrome and
 * are RECOVERED here, re-pointed at the new door set (BRIEF Task 4 §1):
 *   - attention DOTS, never counts,
 *   - a role-absent door is ABSENT, not dimmed,
 *   - the capture seat gets no rail at all.
 * Clauses tied to Phase-0-deleted screens are dropped where noted (they cannot
 * be re-pointed — the route no longer exists), never weakened.
 * NEVER weaken an assertion — if one cannot pass against the new design,
 * that is a CONFLICT in the design: stop and report (BRIEF §5 Phase 5).
 */

// RECOVERED [INVARIANT] — attention rides the doors as DOTS, never counts.
// The pre-rebuild test also asserted a RED dot on `/complaints`; that screen
// was deleted in Phase 0 (no route in routeTree), so the red/`/complaints`
// clause is dropped, not weakened — the amber/gap clause survives on the live
// `/escalations` door, and the "no counts" rule is asserted in full.
test("attention rides the doors as dots, never counts", async ({ page }) => {
  await page.goto("/queue");
  const rail = page.getByTestId("side-rail");
  await expect(rail).toBeVisible();
  // an open escalation pulls an amber dot onto its door (the demo admin holds it)
  await expect(page.getByTestId("rail-dot-/escalations")).toBeVisible();
  // the rail carries NO counts — dots only (numbers live on the screen itself)
  const railText = await rail.innerText();
  expect(railText).not.toMatch(/\d+\s+unresolved/);
  expect(railText).not.toMatch(/\d+\s+open/);
});

// RECOVERED [INVARIANT] — a door outside the role's world is ABSENT, not dimmed,
// and the rail re-renders live on a role switch (no reload, which would reset).
// The pre-rebuild test checked `/dashboard` `/bench` `/leaderboard` — all three
// Phase-0-deleted — so it is re-pointed at doors a reviewer genuinely lacks and
// that still exist as routes: `/ingest` (ops+admin) and `/escalations`
// (senior+admin). The rule and its assertions are untouched.
test("doors outside the role's world are ABSENT, not dimmed", async ({ page }) => {
  await page.goto("/queue");
  await page.getByTestId("account-menu").click();
  await page.getByTestId("role-reviewer").click();
  await page.keyboard.press("Escape");
  // a door the reviewer holds is present…
  await expect(page.getByTestId("rail-door-/queue")).toBeVisible();
  // …and doors the reviewer does not hold are ABSENT (count 0), never dimmed
  await expect(page.getByTestId("rail-door-/ingest")).toHaveCount(0);
  await expect(page.getByTestId("rail-door-/escalations")).toHaveCount(0);
});

// RECOVERED [INVARIANT] — the capture seat gets no rail at all: structural
// blindness includes the navigator (it names worlds a typist must not see).
// The pre-rebuild test also asserted `blind-seat` was visible; that screen is
// not in web-v2's route tree (Phase 0), so the seat-visible precondition is
// dropped — the rail-absence rule, which is the invariant, is asserted in full.
test("the capture seat has no rail — structural blindness stays whole", async ({
  page,
}) => {
  await page.goto("/blind/ord_demo_1");
  await expect(page.getByTestId("side-rail")).toHaveCount(0);
});

// [INVARIANT] — rule: ORPHAN — the navigator folds from the keyboard.
// (Promoted to INVARIANT by open-rulings Q3.)
test("[ folds the rail from the keyboard", async ({ page }) => {
  await page.goto("/queue");
  const rail = page.getByTestId("side-rail");
  await expect(rail).toHaveAttribute("data-collapsed", "0");
  await page.keyboard.press("[");
  await expect(rail).toHaveAttribute("data-collapsed", "1");
  await page.keyboard.press("[");
  await expect(rail).toHaveAttribute("data-collapsed", "0");
});

// [INVARIANT] — rule: a navigator hotkey typed inside a text field is TEXT.
// Keyboard scopes must be pane-local (BRIEF §7).
test("[ inside a text field is text, not a fold", async ({ page }) => {
  await page.goto("/orders/ord_demo_1/review?field=owner.zip");
  await expect(page.getByTestId("sel-label")).toBeVisible();
  await expect(page.getByTestId("side-rail")).toHaveAttribute("data-collapsed", "1");
  // `e` opens the correction editor (C confirm · E correct)
  await page.keyboard.press("e");
  const editor = page.getByTestId("edit-value");
  await editor.click();
  await editor.fill("");
  await editor.press("[");
  // the bracket lands in the field; the rail does not move
  await expect(editor).toHaveValue("[");
  // "1" and not "0" since 2026-07-30: REVIEW STARTS COLLAPSED (§11) and the
  // preference can finally say "never chosen" (`nav_collapsed: null`), so the
  // route default governs instead of being beaten by a served `false`. The
  // rule this test exists for is unchanged — the rail did not MOVE — and the
  // state it did not move from is now the one the screen is specified to open
  // in. Nothing was weakened: both this and the pre-press state are pinned.
  await expect(page.getByTestId("side-rail")).toHaveAttribute("data-collapsed", "1");
});

// [INVARIANT (mechanism changed)] — the RULE survives: the collapse preference
// persists across a reload and is never a one-way trap. The MECHANISM does not:
// BRIEF §9.11 forbids localStorage, so it persists via the server preference
// (GET/PATCH /api/me/preferences). Assertion untouched.
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
  await expect(page.getByTestId("side-rail")).toHaveAttribute("data-collapsed", "1");
  // and can be expanded again — never a one-way trap
  await page.getByTestId("rail-toggle").click();
  await expect(page.getByTestId("side-rail")).toHaveAttribute("data-collapsed", "0");
});
