import { expect, test } from "@playwright/test";

/**
 * [INVARIANT] — rule: a global chord is SUSPENDED, not cancelled, while a text
 * surface or an overlay holds focus, and it RESUMES on close with no click.
 *
 * The reference prototype guards exactly one way — a tagName test on
 * `e.target` (INPUT/TEXTAREA/SELECT/isContentEditable) — and that test is
 * structurally insufficient under react-aria-components, whose Menu, Select,
 * ComboBox and GridList listboxes are `<div role="listbox">`: they are NOT
 * INPUT, they DO implement typeahead, and C/E/Q/J/K/Z// are all printable.
 * A tagName guard lets `q` both escalate the open field AND jump the menu to
 * "Quarantine". The prototype also never guards on `shortcutsOpen`, so `?`
 * then `c` CONFIRMS A RULING FROM INSIDE THE CHEAT SHEET — the same trap
 * `queue-keys.spec` pins for the queue, on the field that carries T1 exposure.
 *
 * These bound the guard by SCOPE, not by tag: the innermost layer that can use
 * a key wins, and the global layer stands down whenever any composite or
 * overlay is the active element.
 */

const REVIEW = "/orders/ord_demo_1/review";

async function openReview(page: import("@playwright/test").Page) {
  await page.goto(REVIEW);
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
}

test("a chord typed into a text input is TEXT, and the ruling does not move", async ({
  page,
}) => {
  await openReview(page);
  await page.keyboard.press("e");
  const editor = page.getByTestId("edit-value");
  await expect(editor).toBeFocused();
  await page.keyboard.type("cqjkz");
  await expect(editor).toHaveValue(/cqjkz$/);
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
  await expect(page.getByTestId("key-map")).toHaveCount(0);
});

test("Escape leaves the editor and the chords resume WITHOUT a click", async ({
  page,
}) => {
  await openReview(page);
  await page.keyboard.press("e");
  await expect(page.getByTestId("edit-value")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("edit-value")).toHaveCount(0);
  // No click, no focus() call — the very next keystroke is a chord again.
  await page.keyboard.press("j");
  await expect(page.getByTestId("sel-label")).toHaveText("MTG 1 — LENDER");
});

test("an open react-aria listbox owns its typeahead — q does not escalate", async ({
  page,
}) => {
  await openReview(page);
  await page.getByTestId("na-state-select").click();
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  // `q` is typeahead inside the popover, never the escalate chord.
  await page.keyboard.press("q");
  await expect(page.getByTestId("escalate-confirm")).toHaveCount(0);
  await expect(listbox).toBeVisible();
  // `z` likewise must not toggle the citation zoom behind the popover.
  await page.keyboard.press("z");
  await expect(page.getByTestId("evidence-pane")).toHaveAttribute(
    "data-zoomed",
    "0",
  );
  await page.keyboard.press("Escape");
  await expect(listbox).toHaveCount(0);
  await page.keyboard.press("z");
  await expect(page.getByTestId("evidence-pane")).toHaveAttribute(
    "data-zoomed",
    "1",
  );
});

test("the ? map stands the REVIEW chords down — c must not confirm a T1 ruling", async ({
  page,
}) => {
  await openReview(page);
  const before = await page.getByTestId("decisions-settled").textContent();
  await page.keyboard.press("?");
  await expect(page.getByTestId("key-map")).toBeVisible();
  await page.keyboard.press("c");
  await expect(page.getByTestId("decisions-settled")).toHaveText(before ?? "");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("key-map")).toHaveCount(0);
  await page.keyboard.press("c");
  await expect(page.getByTestId("decisions-settled")).not.toHaveText(
    before ?? "",
  );
});

test("the command palette owns / and ? while it is up", async ({ page }) => {
  await openReview(page);
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByTestId("command-palette-input");
  await expect(palette).toBeFocused();
  await page.keyboard.type("?/");
  await expect(palette).toHaveValue("?/");
  await expect(page.getByTestId("key-map")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp("/review"));
  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);
  await page.keyboard.press("?");
  await expect(page.getByTestId("key-map")).toBeVisible();
});

test("every chord is DEAD until signed in", async ({ page }) => {
  await page.goto("/sign-in");
  for (const k of ["?", "/", "c", "e", "q", "j", "k", "z"]) {
    await page.keyboard.press(k);
  }
  await expect(page.getByTestId("key-map")).toHaveCount(0);
  await expect(page).toHaveURL(/\/sign-in/);
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByTestId("command-palette-input")).toHaveCount(0);
});

test("countersign is refused by the SERVER with a 409, not by button state", async ({
  page,
}) => {
  await openReview(page);
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/second-reads")),
    page.getByTestId("countersign").click({ force: true }),
  ]);
  expect(res.status()).toBe(409);
  await expect(page.getByTestId("countersign")).toHaveAttribute(
    "title",
    /cannot countersign your own rulings/i,
  );
});
