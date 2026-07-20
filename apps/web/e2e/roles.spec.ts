import { expect, test } from "@playwright/test";

/**
 * §0.7 role worlds (nav.ts WORLDS) beyond the reviewer case account.spec
 * already pins. `page.goto` resets the in-memory session to admin, so every
 * test switches role ONCE via the Account screen and then moves only through
 * chords and links — never another goto.
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

test("typist world: no doors but capture and account", async ({ page }) => {
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

test("senior world: escalations open; queue and readout do not exist", async ({
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

test("ops world: readout opens; the bench does not exist", async ({
  page,
}) => {
  await become(page, "ops");
  await chord(page, "d");
  await expect(page).toHaveURL(/\/dashboard/);
  await chord(page, "b");
  await expect(page).toHaveURL(/\/dashboard/);
});

test("engineer world: bench opens; the readout does not exist", async ({
  page,
}) => {
  await become(page, "engineer");
  await chord(page, "b");
  await expect(page).toHaveURL(/\/bench$/);
  await chord(page, "d");
  await expect(page).toHaveURL(/\/bench$/);
});
