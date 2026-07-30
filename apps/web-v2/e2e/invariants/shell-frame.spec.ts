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

test("the order strip stays put while the screen scrolls under it", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/orders/ord_demo_1/review");
  const strip = page.getByTestId("order-strip");
  const before = await boxOf(strip);
  await page.mouse.move(900, 600);
  await page.mouse.wheel(0, 1400);
  await page.waitForTimeout(300);
  const after = await boxOf(strip);
  expect(after.y, "the strip counts the order it sits above; it may not scroll away").toBe(
    before.y,
  );
});

test("the rail is a full-height column, not a page-sticky element", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/rulebook");
  const rail = await boxOf(page.getByTestId("side-rail"));
  expect(rail.y).toBe(0);
  expect(rail.height).toBe(1000);
});

test("a screen renders at the width the export draws, not the shell's", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  // Rulebook is the widest reading column the export draws: 1160px. Before the
  // fix it had no measure at all and ran to the shell's 1440px cap.
  await page.goto("/rulebook");
  const heading = await boxOf(page.getByRole("heading", { level: 1 }).first());
  expect(heading.x).toBeGreaterThan(300);
});

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
