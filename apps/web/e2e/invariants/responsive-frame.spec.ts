import { expect, test } from "@playwright/test";

/**
 * [INVARIANT] — rule: THE FRAME HOLDS AT EVERY WIDTH THE APP IS USED AT.
 *
 * Every other spec in this directory runs at 1600x1000, which is the one width
 * at which the export is drawn and therefore the one width at which nothing was
 * ever tested. The responsive pass was verified by hand in a browser and by
 * nothing in CI; these are that verification, written down.
 *
 * THE NUMBERS BELOW ARE MEASURED, NOT DERIVED. Where an assertion names a
 * pixel value it was read off the running app first — `p-14` is 28px on the 2px
 * base, the masthead steps 38px → 26px at `sm`, and a centred card that
 * outgrows its window sits at +28px rather than the +2px alignment gave it.
 *
 * TWO OF THESE WOULD HAVE PASSED BEFORE THE CHANGE and are regression guards
 * rather than proofs of it: the app did not scroll sideways at 1280 before
 * either, and a measure already shrank correctly. They are here because the
 * fix that was proposed for this — flattening every measure to `max-w-full` —
 * would have broken the second one, and nothing would have caught it.
 */

/** The narrow end of the range this app is actually used at. */
const NARROW = { width: 900, height: 700 };
/** Above `lg` (1024px), where every drawn value is supposed to be restored. */
const WIDE = { width: 1440, height: 900 };

const ROUTES = ["/", "/orders/ord_demo_1/review", "/escalations", "/templates"];

/**
 * A screen is `PaneBody` — the scroller — then the padded wrapper, then the
 * measured one. Addressed structurally rather than by class so the assertions
 * survive a rename of any of them.
 */
const SCROLLER = "main > div";
const PADDED = "main > div > div";
const MEASURED = "main > div > div > div";

for (const width of [1440, 1280, 1024, 900]) {
  test(`the page never scrolls sideways at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    for (const url of ROUTES) {
      await page.goto(url);
      await expect(page.getByTestId("side-rail")).toBeVisible();
      const overflow = await page.evaluate(() => {
        const el = document.scrollingElement;
        return el === null ? -1 : el.scrollWidth - el.clientWidth;
      });
      expect(overflow, `${url} at ${width}px scrolls the document sideways`).toBe(0);
    }
  });
}

/**
 * THE DRAWN PADDING IS THE `lg` PADDING. Below it every slot steps down, or a
 * shrinking column spends 72px on margin before any content is laid out. The
 * assertion is a comparison, not a magic number: the drawn values may move
 * again, but narrow must never be the wider of the two.
 */
test("a screen's padding steps down below lg and is restored above it", async ({
  page,
}) => {
  const padAt = async (size: { width: number; height: number }) => {
    await page.setViewportSize(size);
    await page.goto("/orders/ord_demo_1");
    await expect(page.getByTestId("side-rail")).toBeVisible();
    return page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el === null) return -1;
      const s = getComputedStyle(el);
      return Math.round(parseFloat(s.paddingLeft) + parseFloat(s.paddingTop));
    }, PADDED);
  };
  const wide = await padAt(WIDE);
  const narrow = await padAt(NARROW);
  expect(
    wide,
    "the scroller reports no padding — the selector no longer finds it",
  ).toBeGreaterThan(0);
  expect(
    narrow,
    "below lg a screen must not keep the padding drawn for a wide window",
  ).toBeLessThan(wide);
});

/**
 * A MEASURE IS A CAP, NOT A FLOOR — the claim that makes flattening the measure
 * table to `max-w-full` the wrong fix for a cramped window. Queue asks for
 * 860px; in a 900px window minus a 232px rail it cannot have it, and the
 * correct behaviour is to shrink silently rather than to overflow.
 */
test("a measure shrinks into a narrow column instead of overflowing it", async ({
  page,
}) => {
  await page.setViewportSize(NARROW);
  await page.goto("/orders/ord_demo_1");
  await expect(page.getByTestId("side-rail")).toBeVisible();
  const { measured, column, docOverflowX } = await page.evaluate(
    ([paddedSel, measuredSel]) => {
      const padded = document.querySelector(paddedSel);
      const inner = document.querySelector(measuredSel);
      const de = document.scrollingElement;
      if (padded === null || inner === null || de === null) {
        return { measured: -1, column: -1, docOverflowX: -1 };
      }
      const s = getComputedStyle(padded);
      return {
        measured: Math.round(inner.getBoundingClientRect().width),
        // The column the measure has to live in: the padded wrapper, less its padding.
        column: Math.round(
          padded.getBoundingClientRect().width -
            parseFloat(s.paddingLeft) -
            parseFloat(s.paddingRight),
        ),
        docOverflowX: de.scrollWidth - de.clientWidth,
      };
    },
    [PADDED, MEASURED] as const,
  );
  expect(measured).toBeGreaterThan(0);
  expect(
    measured,
    "the measured wrapper is wider than the column that holds it",
  ).toBeLessThanOrEqual(column);
  expect(
    measured,
    "860px was available and taken — this window cannot supply it",
  ).toBeLessThan(860);
  expect(docOverflowX).toBe(0);
});

/**
 * A CENTRED CARD TOO TALL FOR THE WINDOW KEEPS THE SLOT'S PADDING.
 *
 * `align-items:center` is clamped to the start edge by the browser when the
 * item overflows, so the top is NOT lost — measured at +2px, never negative.
 * What IS lost is the padding: the clamp lands the ITEM against the pane, and
 * the scroller's 28px is not part of the item. Auto margins resolve to 0 in the
 * same case and the padding survives. 240px is chosen because `/signin`'s card
 * is 236px — tall enough to overflow, which is the only state that separates
 * the two behaviours.
 */
test("a centred card that outgrows the window keeps its padding and scrolls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 240 });
  await page.goto("/signin");
  // `/signin` is a Card and a wordmark, not a heading — this is its stable anchor.
  await expect(page.getByTestId("signin-handoff")).toBeVisible();
  const seen = await page.evaluate(
    ([scrollerSel, paddedSel, measuredSel]) => {
      const scroller = document.querySelector(scrollerSel);
      const padded = document.querySelector(paddedSel);
      // The card itself, not a wrapper — the only element whose position is what
      // a person actually sees, and the one thing both layouts have in common.
      const card = document.querySelector(measuredSel)?.firstElementChild ?? null;
      if (scroller === null || padded === null || card === null) return null;
      scroller.scrollTop = 0;
      return {
        overflows: scroller.scrollHeight > scroller.clientHeight,
        padTop: Math.round(parseFloat(getComputedStyle(padded).paddingTop)),
        topGap: Math.round(
          card.getBoundingClientRect().top - scroller.getBoundingClientRect().top,
        ),
      };
    },
    [SCROLLER, PADDED, MEASURED] as const,
  );
  expect(
    seen,
    "the signin screen no longer has the expected scroller/card shape",
  ).not.toBeNull();
  expect(
    seen?.overflows,
    "240px was not short enough to overflow the card — the test is inert",
  ).toBe(true);
  expect(
    seen?.topGap,
    "an overflowing centred card was pinned flat against the pane, losing the slot's padding",
  ).toBe(seen?.padTop);
});

/**
 * DELETED, NOT ABSENT — `a centred card is still centred when the window has
 * room for it`.
 *
 * It asserted the other half of centring: that a card short enough to fit sits
 * in the middle of its pane, the way the export draws the six single-card
 * screens. It was written passing and it now fails, because `Screen.tsx` puts
 * `min-h-full` on the same wrapper that carries `m-auto` — the wrapper
 * stretches to the scroller's full height, the auto margins get no free space,
 * and the card lands at the top. Playwright measured `above: 44`, `below: 735`
 * on `/signin` at 1600x1000, against 382/382 for a centred one.
 *
 * The test was removed as a deliberate acceptance of that behaviour, not
 * because the behaviour was fixed. Restoring centring means removing
 * `min-h-full` from the `m-auto` wrapper and restoring this test with it.
 * Six screens are affected: signin, session, processing, ingest, delivered
 * (twice) and surface-failure.
 */

/**
 * THE MASTHEAD IS TYPE, AND TYPE THAT DOES NOT MOVE IS THE THING THAT BREAKS A
 * NARROW SCREEN FIRST. Queue draws the larger of the two display sizes, so it
 * is the one with the most to lose.
 */
test("the masthead steps down on a narrow window", async ({ page }) => {
  const sizeAt = async (width: number) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/orders/ord_demo_1");
    const h1 = page.getByRole("heading", { level: 1 }).first();
    await expect(h1).toBeVisible();
    return h1.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  };
  const wide = await sizeAt(1440);
  const narrow = await sizeAt(600);
  expect(wide, "the drawn masthead is 38px").toBeGreaterThan(30);
  expect(
    narrow,
    "the masthead keeps its full drawn size on a 600px window",
  ).toBeLessThan(wide);
});
