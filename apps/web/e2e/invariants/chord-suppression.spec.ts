import { expect, test } from "@playwright/test";
import { interceptApi } from "../helpers/net";

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

/*
 * UPDATED under RULING-2026-08-29 (docs/frontend/design-2026-08/
 * RULING-2026-08-29.md): the absence picker is the reference's drawn 2×2 GRID
 * of buttons now, not a react-aria Select, so there is no listbox on this
 * screen to own a typeahead — that suppression rule stays pinned DOM-free in
 * src/shared/focusOwnership.test.ts. What this pins instead is the drawn
 * behaviour that replaced it: the four absence options render as the grid,
 * and `z` performs the drawn zoom-to-citation (scale to the recorded box) and
 * `Escape` fits again.
 */
test("the drawn NA grid stands where the select was, and z zooms to the citation", async ({
  page,
}) => {
  await openReview(page);
  // The drawn grid: all four Law 3 absences, as buttons, 2×2.
  await page.getByTestId("act-absence").click();
  await expect(page.getByTestId("na-state-grid")).toBeVisible();
  await expect(page.getByTestId("na-state-grid").getByRole("button")).toHaveCount(4);
  // Leave the editor, so the chords resume without a click…
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("na-state-grid")).toHaveCount(0);
  // …then `z` toggles the drawn citation zoom…
  await page.keyboard.press("z");
  await expect(page.getByTestId("evidence-pane")).toHaveAttribute(
    "data-zoomed",
    "1",
  );
  // …and Escape fits again, as the drawn note says.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("evidence-pane")).toHaveAttribute(
    "data-zoomed",
    "0",
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

/*
 * UPDATED for the built surface (RULING-2026-08-29 completed this flow): the
 * act is per ruling at POST /api/fields/{id}/countersign — one act, one
 * record — and design rule 13 is the SERVER's 409, rendered verbatim in the
 * panel, never button state. The 409 is forced at the fetch layer so the pin
 * holds whichever examiner the session happens to hold.
 */
test("countersign is refused by the SERVER with a 409, not by button state", async ({
  page,
}) => {
  await interceptApi(page, {
    method: "POST",
    match: "/countersign",
    status: 409,
    body: { error: "a second read must come from a different examiner than the one who ruled" },
  });
  await openReview(page);
  const signature = page.getByTestId("countersign-signature");
  await signature.fill("L. Vance");
  await page
    .getByTestId("countersign-panel")
    .getByRole("button", { name: "Countersign" })
    .first()
    .click();
  await expect(page.getByTestId("countersign-refusal")).toContainText(
    "a second read must come from a different examiner",
  );
});
