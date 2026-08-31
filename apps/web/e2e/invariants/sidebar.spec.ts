import { expect, test } from "@playwright/test";

/**
 * Navigator (collapsible left sidebar) invariants. The collapse persists
 * through GET/PATCH /api/me/preferences — server-side preferences, never
 * localStorage. Never weaken an assertion — a test that cannot pass
 * against the new design is a conflict in the design: stop and report.
 */

// Rule: the rail doors wear served badges — the ornaments arrive finished
// off `GET /api/rail` (asserted by pinning the fixture's exact strings),
// and the rail composes no caption of its own.
test("the rail doors wear the served badges the reference draws", async ({ page }) => {
  await page.goto("/orders/ord_demo_1");
  const rail = page.getByTestId("side-rail");
  await expect(rail).toBeVisible();
  // the All Orders door carries the served orders total — the browse table's
  // own count (13 demo orders), never a length counted in the browser
  await expect(page.getByTestId("rail-badge-/orders-list")).toHaveText("13");
  // the open escalations pull the served QC pill onto the door, WHOLE — the
  // fixture holds 4 unresolved escalations and the server captions them
  await expect(page.getByTestId("rail-badge-/escalations")).toHaveText("4 QC");
  // Templates Architect wears the template resource's own version
  await expect(page.getByTestId("rail-badge-/templates")).toHaveText("v4.2");
  // the rail still AUTHORS no caption — a served pill is not a composed count
  const railText = await rail.innerText();
  expect(railText).not.toMatch(/\d+\s+unresolved/);
  expect(railText).not.toMatch(/\d+\s+open/);
});

// Rule: a door outside the role's world is absent, not dimmed, and the
// rail re-renders live on a role switch (no reload, which would reset).
test("doors outside the role's world are ABSENT, not dimmed", async ({ page }) => {
  await page.goto("/orders/ord_demo_1");
  await page.getByTestId("account-menu").click();
  await page.getByTestId("role-reviewer").click();
  await page.keyboard.press("Escape");
  // a door the reviewer holds is present…
  await expect(page.getByTestId("rail-door-/orders-list")).toBeVisible();
  // …and doors the reviewer does not hold are ABSENT (count 0), never dimmed
  await expect(page.getByTestId("rail-door-/ingest")).toHaveCount(0);
  await expect(page.getByTestId("rail-door-/escalations")).toHaveCount(0);
});

// Rule: the capture seat gets no rail at all — structural blindness
// includes the navigator, which names worlds a typist must not see.
test("the capture seat has no rail — structural blindness stays whole", async ({
  page,
}) => {
  await page.goto("/blind/ord_demo_1");
  await expect(page.getByTestId("side-rail")).toHaveCount(0);
});

// Rule (recorded nowhere else): the navigator folds from the keyboard.
test("[ folds the rail from the keyboard", async ({ page }) => {
  await page.goto("/orders/ord_demo_1");
  const rail = page.getByTestId("side-rail");
  await expect(rail).toHaveAttribute("data-collapsed", "0");
  await page.keyboard.press("[");
  await expect(rail).toHaveAttribute("data-collapsed", "1");
  await page.keyboard.press("[");
  await expect(rail).toHaveAttribute("data-collapsed", "0");
});

// Rule: a navigator hotkey typed inside a text field is text — keyboard
// scopes are pane-local.
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
  // "1", not "0": Review starts collapsed, and the preference can say
  // "never chosen" (`nav_collapsed: null`), so the route default governs.
  // The rule this test exists for is unchanged — the rail did not move.
  await expect(page.getByTestId("side-rail")).toHaveAttribute("data-collapsed", "1");
});

// Rule: the collapse preference persists across a reload and is never a
// one-way trap — via the server preference (GET/PATCH /api/me/preferences),
// never localStorage.
test("collapse is a persisted UI preference", async ({ page }) => {
  await page.goto("/orders/ord_demo_1");
  const rail = page.getByTestId("side-rail");
  await expect(rail).toHaveAttribute("data-collapsed", "0");
  await page.getByTestId("rail-toggle").click();
  await expect(rail).toHaveAttribute("data-collapsed", "1");
  // labels collapse away; the chord key and dots remain
  await expect(page.getByTestId("rail-door-/orders-list")).toBeVisible();
  // survives a reload — via the server preference, never localStorage
  // (check-rules rejects it).
  await page.reload();
  await expect(page.getByTestId("side-rail")).toHaveAttribute("data-collapsed", "1");
  // and can be expanded again — never a one-way trap
  await page.getByTestId("rail-toggle").click();
  await expect(page.getByTestId("side-rail")).toHaveAttribute("data-collapsed", "0");
});
