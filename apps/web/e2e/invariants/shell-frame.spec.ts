import { expect, test, type Locator } from "@playwright/test";

/**
 * Rule: the app is one frame — rooted at `height:100vh;overflow:hidden`,
 * scrolling only the screen body, so the rail, the order strip and every
 * docked bar stay where they are put.
 *
 * Rule: `main` fills the content column. Auto inline margins on a flex
 * item cancel `align-self:stretch`, so `mx-auto` on a `flex-1` `main`
 * sizes it shrink-to-fit; the binding constraint is the container, not the
 * window, so the assertion is on the box at a fixed viewport.
 *
 * Rule: no chrome for somebody who is not signed in.
 */

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("element has no box — it is not rendered");
  return box;
}

test("the page never scrolls — the frame is one viewport tall", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/orders/ord_demo_1/review");
  await expect(page.getByTestId("order-strip")).toBeVisible();
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement;
    return el === null ? -1 : el.scrollHeight - el.clientHeight;
  });
  expect(overflow, "the document itself must never be the scroller").toBe(0);
});

test("main fills the content column rather than shrink-wrapping", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/orders/ord_demo_1");
  const rail = await boxOf(page.getByTestId("side-rail"));
  const main = await boxOf(page.locator("main"));
  expect(main.width).toBeGreaterThanOrEqual(1600 - rail.width - 1);
});

test("the order strip stays put while the screen scrolls under it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/orders/ord_demo_1/review");
  const strip = page.getByTestId("order-strip");
  const before = await boxOf(strip);
  await page.mouse.move(900, 600);
  await page.mouse.wheel(0, 1400);
  await page.waitForTimeout(300);
  const after = await boxOf(strip);
  expect(
    after.y,
    "the strip counts the order it sits above; it may not scroll away",
  ).toBe(before.y);
});

test("the rail is a full-height column, not a page-sticky element", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/templates");
  const rail = await boxOf(page.getByTestId("side-rail"));
  expect(rail.y).toBe(0);
  expect(rail.height).toBe(1000);
});

/**
 * Deleted, not absent — "a screen renders at the width the export draws,
 * not the shell's". `screenClasses` no longer emits a per-screen
 * `max-width` (all measures are `w-full max-w-full`), a deliberate
 * decision, not an accident. This is the third test removed by it, with
 * the two in `Pane.test.ts` and the centring one in
 * `responsive-frame.spec.ts`; restoring the measure table restores all
 * four.
 */

test("nobody signed in is shown an ADMIN world", async ({ page }) => {
  await page.goto("/signin");
  await expect(page.getByTestId("side-rail")).toHaveCount(0);
  await expect(page.getByTestId("order-strip")).toHaveCount(0);
});

test("the session-ended screen is equally bare", async ({ page }) => {
  await page.goto("/session");
  await expect(page.getByTestId("side-rail")).toHaveCount(0);
  await expect(page.getByTestId("order-strip")).toHaveCount(0);
});

/**
 * Nothing is crushed to a sliver — a whole class of defect, not one
 * instance. Any element with `overflow` other than `visible` gives up
 * `min-height: auto`'s protection, and `Card` sets `overflow-hidden` on
 * every instance, so a crowded column can compress a card toward nothing
 * while its content stays readable to `toContainText`. That is why this
 * measures instead of reading. The rule is a comparison, not a magic
 * number: a box may not render shorter than the content inside it — a
 * container that cannot fit its children is what scrolling is for.
 */
const CROWDED = [
  { url: "/orders/ord_demo_1/review", what: "the review report column" },
  { url: "/orders-list", what: "the orders table" },
  { url: "/escalations", what: "the escalation cards" },
];

for (const { url, what } of CROWDED) {
  test(`nothing collapses below its own content — ${what}`, async ({ page }) => {
    await page.goto(url);
    await expect(page.getByTestId("side-rail")).toBeVisible();
    // Let the last query settle; a box measured mid-fetch is legitimately empty.
    await page.waitForTimeout(1200);
    const crushed = await page.evaluate(() => {
      const bad: { testid: string; rendered: number; wants: number }[] = [];
      for (const el of Array.from(document.querySelectorAll("[data-testid]"))) {
        const box = el as HTMLElement;
        // Only elements that actually claim to be on screen. `scrollHeight` on a
        // display:none box is 0, so hidden things cannot produce false alarms.
        if (box.offsetParent === null && box.getClientRects().length === 0) continue;
        const rendered = box.getBoundingClientRect().height;
        // 4px of slack: sub-pixel layout and 1px borders are not a collapse.
        if (box.scrollHeight > rendered + 4) {
          // A deliberate scroller is not a collapse — it is the fix for one.
          const overflowY = getComputedStyle(box).overflowY;
          if (overflowY === "auto" || overflowY === "scroll") continue;
          bad.push({
            testid: box.getAttribute("data-testid") ?? "?",
            rendered: Math.round(rendered),
            wants: box.scrollHeight,
          });
        }
      }
      return bad;
    });
    expect(crushed, `crushed boxes: ${JSON.stringify(crushed)}`).toEqual([]);
  });
}

/**
 * The profile card — a command closes it, a toggle does not.
 * `DropdownMenuItem` for anything that leaves; plain buttons for the theme
 * and role toggles, which must survive being used. The toggle half matters
 * too: `authz.spec` and `sidebar.spec` both click a role and then press
 * Escape, which only means anything if the panel is still open.
 */
test("navigating from the profile card closes it; toggling inside it does not", async ({
  page,
}) => {
  await page.goto("/orders/ord_demo_1");
  await page.getByTestId("account-menu").click();
  await expect(page.getByTestId("profile-card")).toBeVisible();

  // A toggle keeps it open — you flip a theme to look at it.
  await page.getByTestId("theme-toggle").click();
  await expect(page.getByTestId("profile-card")).toBeVisible();
  // …and the toggle actually did something, so this is not passing on a no-op.
  await expect(page.locator("html")).toHaveAttribute("data-theme", "mocha");

  // Escape still dismisses it — the menu keeps what a menu is good at.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("profile-card")).toHaveCount(0);

  // A command closes it, and lands where it said it would.
  await page.getByTestId("account-menu").click();
  await page.getByRole("menuitem", { name: "Audit" }).click();
  await expect(page).toHaveURL(/\/audit$/);
  await expect(page.getByTestId("profile-card")).toHaveCount(0);
});

/**
 * The panel says whose session it is. The role rides along because
 * "acting as" is directly below, and a role switcher with no current role
 * stated is a control with no origin.
 */
test("the profile card names the person and their role", async ({ page }) => {
  await page.goto("/orders/ord_demo_1");
  await page.getByTestId("account-menu").click();
  const card = page.getByTestId("profile-card");
  await expect(card).toContainText("L. Vance");
  await expect(card).toContainText(/admin/i);
});
