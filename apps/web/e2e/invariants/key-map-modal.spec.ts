import { expect, test } from "@playwright/test";

/**
 * [ORPHAN RULE] — rule: the `?` key map is MODAL, and "modal" is a structural
 * claim, not a paint job. `KeyMap`'s own doc comment has always said it — "it is
 * MODAL: while it is up the screen underneath stands its own keys down" — and
 * `navigation.spec` #3 pins the key half of it on Review. Nothing pinned the
 * FOCUS half, and the overlay was a bare `<div class="fixed inset-0 …">`: no
 * `role="dialog"`, no `aria-modal`, no accessible name, no focus move, no trap,
 * and a page behind that was neither `inert` nor hidden. Tab walked straight
 * onto controls the scrim was covering.
 *
 * That is not a cosmetic gap. Combined with the queue's unscoped keys, `?` then
 * Enter HANDED THE READER AN ORDER from inside the cheat sheet, and `?` then `p`
 * opened the pass field behind the overlay. A cheat sheet that fires the
 * commands it describes is the exact trap the component says it is not.
 *
 * `navigation.spec` #3 asserts the same standing-down rule on Review with the
 * review keys; these assert it on Queue with the queue keys, and add the focus
 * clauses no spec covered.
 */

test("the ? map is a real dialog: named, and focus moves into it", async ({ page }) => {
  await page.goto("/orders/ord_demo_1");
  await expect(page.getByTestId("order-ref")).toBeVisible();
  await page.keyboard.press("?");
  const map = page.getByTestId("key-map");
  await expect(map).toHaveAttribute("role", "dialog");
  await expect(map).toHaveAttribute("aria-modal", "true");
  // Named from its own heading — a dialog with no accessible name is
  // unnavigable by screen reader.
  await expect(
    page.getByRole("dialog", { name: /KEYBOARD AS NAVIGATION/ }),
  ).toBeVisible();
  expect(await map.evaluate((node) => node.contains(document.activeElement))).toBe(
    true,
  );
});

test("the ? map traps focus — Tab never lands behind the scrim", async ({ page }) => {
  await page.goto("/orders/ord_demo_1");
  await expect(page.getByTestId("order-ref")).toBeVisible();
  await page.keyboard.press("?");
  const map = page.getByTestId("key-map");
  await expect(map).toBeVisible();
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press("Tab");
    expect(await map.evaluate((node) => node.contains(document.activeElement))).toBe(
      true,
    );
  }
  // …and the page underneath is inert, so not even a programmatic focus reaches
  // a control the scrim covers.
  const reached = await page
    .getByTestId("rail-toggle")
    .evaluate((node: HTMLElement) => {
      node.focus();
      return document.activeElement === node;
    });
  expect(reached).toBe(false);
});

test("the queue's keys stand down while the ? map is open", async ({ page }) => {
  await page.goto("/orders/ord_demo_1");
  await expect(page.getByTestId("order-ref")).toBeVisible();
  await page.keyboard.press("?");
  await expect(page.getByTestId("key-map")).toBeVisible();
  // Enter must not take the order out from under the cheat sheet…
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/queue$/);
  await expect(page.getByTestId("key-map")).toBeVisible();
  // …and `p` must not open the pass field behind the overlay.
  await page.keyboard.press("p");
  await expect(page.getByPlaceholder(/why are you passing/)).toHaveCount(0);
  // Escape closes it and gives the screen its keys back.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("key-map")).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/orders\/ord_demo_1\/review/);
});

test("closing the map returns focus where it came from", async ({ page }) => {
  await page.goto("/orders/ord_demo_1");
  await expect(page.getByTestId("order-ref")).toBeVisible();
  await page.getByTestId("rail-toggle").focus();
  await page.keyboard.press("?");
  await expect(page.getByTestId("key-map")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("key-map")).toHaveCount(0);
  await expect(page.getByTestId("rail-toggle")).toBeFocused();
});
