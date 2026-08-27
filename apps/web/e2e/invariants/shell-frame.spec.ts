import { expect, test, type Locator } from "@playwright/test";

/**
 * [INVARIANT] — rule: THE APP IS ONE FRAME. The export roots at
 * `height:100vh;overflow:hidden` and scrolls only the screen body, so the rail,
 * the order strip and every docked bar stay where they are put. This app rooted
 * at `min-h-screen` and page-scrolled: Review captured at 3,276px against the
 * export's single 1,000px frame, the sidebar terminated over blank ground, and
 * the order ref, four counts and stamp scrolled off every long screen.
 *
 * [INVARIANT] — rule: `main` FILLS THE CONTENT COLUMN. Auto inline margins on a
 * flex item cancel `align-self:stretch`, so `mx-auto` on a `flex-1` `main` sized
 * it shrink-to-fit: Queue drew 670px where it asked for 860px, and Profile —
 * which set no measure — collapsed to its content's 421px where the export
 * draws 720px. No viewport-width guard catches this, because the binding
 * constraint is the CONTAINER, not the window (HANDOFF-UI §6). The assertion is
 * therefore on the box, at a fixed viewport.
 *
 * [INVARIANT] — rule: NO CHROME FOR SOMEBODY WHO IS NOT SIGNED IN. `/signin`
 * rendered the full 232px rail with every ADMIN door and an identity chip
 * reading "L. Vance · ADMIN", because the chrome gated on `/blind` alone.
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
  await page.goto("/queue");
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
  await page.goto("/rulebook");
  const rail = await boxOf(page.getByTestId("side-rail"));
  expect(rail.y).toBe(0);
  expect(rail.height).toBe(1000);
});

/**
 * DELETED, NOT ABSENT — `a screen renders at the width the export draws, not
 * the shell's`.
 *
 * It went to the heart of the [INVARIANT] above: Rulebook is the widest reading
 * column the export draws at 1160px, and the test proved the screen held that
 * column instead of running to the shell's edge, by asserting the heading was
 * indented past 300px at a 1600px viewport.
 *
 * `screenClasses` no longer emits a per-screen `max-width` — all sixteen
 * measures are `w-full max-w-full` — so Rulebook fills its column and the
 * heading starts at the padded left edge. Measured 294px against the 336px it
 * used to sit at. The invariant it guarded is not violated by accident; it was
 * given up on purpose, and the reasoning is in the commit that did it.
 *
 * This is the third test removed by that decision, with the two in
 * `Pane.test.ts`, plus the centring one in `responsive-frame.spec.ts`.
 * Restoring the measure table restores all four.
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
 * NOTHING IS CRUSHED TO A SLIVER. A whole class of defect, not one instance.
 *
 * A flex item is normally protected from shrinking below its own content by
 * `min-height: auto` — but ANY element with `overflow` other than `visible`
 * gives that up, and `Card` sets `overflow-hidden` on every instance. So a card
 * in a column whose siblings want more room than exists gets compressed toward
 * nothing while its content stays in the DOM, fully readable to a test.
 *
 * THAT IS WHY THIS MEASURES INSTEAD OF READING. Found on Review by measuring:
 * the signature record rendered 2px tall wanting 817, and the order rail
 * rendered at ZERO wanting 268 — with three harvested invariants asserting
 * against that rail the whole time, every one of them green, because
 * `toContainText` does not care how tall a box is. The same session had already
 * lost seventeen queue rows to 10px blank rules for the identical reason.
 *
 * The rule is a comparison, not a magic number: a box may not render shorter
 * than the content inside it. A container that cannot fit its children is what
 * scrolling is for.
 */
const CROWDED = [
  { url: "/orders/ord_demo_1/review", what: "the review report column" },
  { url: "/queue", what: "the queue bands" },
  { url: "/completeness", what: "the gap cards" },
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
 * THE PROFILE CARD — a command closes it, a toggle does not.
 *
 * Not a style preference: it is the difference between a panel that gets out of
 * your way and one that sits over the screen it just sent you to. When the
 * card's navigation entries were rewritten as plain buttons they stopped
 * closing, and the panel's own backdrop then swallowed every subsequent click —
 * the app looked frozen. `DropdownMenuItem` for anything that leaves, plain
 * buttons for the theme and role toggles, which must survive being used.
 *
 * The toggle half matters just as much: `authz.spec` and `sidebar.spec` both
 * click a role and then press Escape, which only means anything if the panel is
 * still open to be dismissed.
 */
test("navigating from the profile card closes it; toggling inside it does not", async ({
  page,
}) => {
  await page.goto("/queue");
  await page.getByTestId("account-menu").click();
  await expect(page.getByTestId("profile-card")).toBeVisible();

  // A TOGGLE KEEPS IT OPEN — you flip a theme to look at it.
  await page.getByTestId("theme-toggle").click();
  await expect(page.getByTestId("profile-card")).toBeVisible();
  // …and the toggle actually did something, so this is not passing on a no-op.
  await expect(page.locator("html")).toHaveAttribute("data-theme", "mocha");

  // Escape still dismisses it — the menu keeps what a menu is good at.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("profile-card")).toHaveCount(0);

  // A COMMAND CLOSES IT, and lands where it said it would.
  await page.getByTestId("account-menu").click();
  await page.getByRole("menuitem", { name: "Audit" }).click();
  await expect(page).toHaveURL(/\/audit$/);
  await expect(page.getByTestId("profile-card")).toHaveCount(0);
});

/**
 * THE PANEL SAYS WHOSE SESSION IT IS. The list it replaced opened on the word
 * "Account" with no person on it — the name sat on the trigger you had just
 * clicked and covered up, so the one surface whose subject is identity never
 * named it. The role rides along because "acting as" is directly below, and a
 * role switcher with no current role stated is a control with no origin.
 */
test("the profile card names the person and their role", async ({ page }) => {
  await page.goto("/queue");
  await page.getByTestId("account-menu").click();
  const card = page.getByTestId("profile-card");
  await expect(card).toContainText("L. Vance");
  await expect(card).toContainText(/admin/i);
});
