import { expect, test } from "@playwright/test";

/**
 * HARVESTED INVARIANTS — migrated from apps/web @ ade49af (pre-rebuild).
 * Source: apps/web/e2e/roles.spec.ts
 *
 * Every test here is SKIPPED until the feature it covers lands in web-v2.
 * Un-skip as each feature lands. Rewrite selectors freely.
 * NEVER weaken an assertion — if one cannot pass against the new design,
 * that is a CONFLICT in the design: stop and report (BRIEF §5 Phase 5).
 */

const become = async (
  page: import("@playwright/test").Page,
  role: string,
) => {
  await page.goto("/account");
  await page.getByRole("button", { name: "Me" }).click();
  await page.getByTestId(`role-${role}`).click();
};

const chord = async (
  page: import("@playwright/test").Page,
  key: string,
) => {
  await page.keyboard.press("g");
  await page.keyboard.press(key);
};
// TODO(rebuild) [INVARIANT] — rule: §0.7 — a typist's world is capture + account only; chords to other worlds are refused and out-of-world links are ABSENT.
test.skip("typist world: no doors but capture and account", async ({ page }) => {
  await become(page, "typist");
  // the map offers only the account door
  await page.keyboard.press("?");
  const map = page.getByTestId("key-map");
  await expect(map).toBeVisible();
  await expect(map).toContainText("account");
  await expect(map).not.toContainText("escalation inbox");
  await expect(map).not.toContainText("readout");
  await page.keyboard.press("Escape");
  await expect(map).toHaveCount(0);
  // chords to other worlds are refused — still on /account
  await chord(page, "q");
  await expect(page).toHaveURL(/\/account/);
  await chord(page, "d");
  await expect(page).toHaveURL(/\/account/);
  await chord(page, "s");
  await expect(page).toHaveURL(/\/account/);
  // TopBar links outside the world are ABSENT, not dimmed
  await expect(page.getByRole("link", { name: "Readout" })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Blind fifty status" }),
  ).toHaveCount(0);
});

// TODO(rebuild) [INVARIANT] — rule: §0.7 — a senior holds escalations; queue and readout do not exist for them.
test.skip("senior world: escalations open; queue and readout do not exist", async ({
  page,
}) => {
  await become(page, "senior");
  await chord(page, "e");
  await expect(page).toHaveURL(/\/escalations/);
  await chord(page, "q");
  await expect(page).toHaveURL(/\/escalations/);
  await chord(page, "d");
  await expect(page).toHaveURL(/\/escalations/);
});

// TODO(rebuild) [INVARIANT] — rule: §0.7 — ops holds the readout; the bench does not exist for them.
test.skip("ops world: readout opens; the bench does not exist", async ({
  page,
}) => {
  await become(page, "ops");
  await chord(page, "d");
  await expect(page).toHaveURL(/\/dashboard/);
  await chord(page, "b");
  await expect(page).toHaveURL(/\/dashboard/);
});

// TODO(rebuild) [INVARIANT] — rule: §0.7 — an engineer holds the bench; the readout does not exist for them.
test.skip("engineer world: bench opens; the readout does not exist", async ({
  page,
}) => {
  await become(page, "engineer");
  await chord(page, "b");
  await expect(page).toHaveURL(/\/bench$/);
  await chord(page, "d");
  await expect(page).toHaveURL(/\/bench$/);
});
