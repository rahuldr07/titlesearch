import { describe, expect, test } from "vitest";
import { paneClasses } from "./Pane";
import { screenClasses, screenScroller } from "./screenClasses";

/**
 * These guard the two classes whose ABSENCE is invisible.
 *
 * A missing `min-h-0` on a flex scroller does not throw, does not warn, and
 * does not look wrong until the content is long enough to overflow — at which
 * point the page grows instead of the box scrolling, and the bug reads as a
 * design decision. The audit found exactly this shape: web-v2 had one
 * `overflow-y-auto` in the whole of `src/` outside `Card`, and Review rendered
 * 3,276px tall against the export's 1,000px frame.
 *
 * The same argument covers `Screen`'s measure map. Every entry is a width the
 * export actually draws, read off its markup; a wrong or missing one renders a
 * screen at the shell's full width, which is what made Rulebook stretch where
 * the export holds a 1,160px column. A `cva` config is a pure function from
 * variant to class list, so both are provable in node with no DOM.
 */

describe("Pane", () => {
  test("the body scrolls itself and can shrink below its content", () => {
    expect(paneClasses.body).toContain("overflow-y-auto");
    expect(
      paneClasses.body,
      "min-h-0 is what lets a flex child shrink below its content; without it the page grows instead of the box scrolling",
    ).toContain("min-h-0");
    expect(
      paneClasses.body,
      "min-w-0 is the same guarantee on the other axis; without it a wide child pushes the pane past its column instead of scrolling inside it",
    ).toContain("min-w-0");
  });

  test("the body is a containing block, so sr-only labels cannot escape the frame", () => {
    expect(
      paneClasses.body,
      "Tailwind's sr-only is position:absolute; without `relative` here its containing block is the initial one, so it escapes overflow-hidden and extends the document's scroll area",
    ).toContain("relative");
  });

  test("the pane is a flex column that can itself shrink", () => {
    expect(paneClasses.pane).toContain("flex-col");
    expect(paneClasses.pane).toContain("min-h-0");
  });

  test("header and footer are pinned, never scrollers", () => {
    for (const slot of [paneClasses.header, paneClasses.footer]) {
      expect(slot).toContain("flex-none");
      expect(slot).not.toContain("overflow");
    }
  });
});

/**
 * THE PER-SCREEN MEASURE IS GONE, DELIBERATELY, AND THIS IS WHERE IT WENT.
 *
 * Two tests stood here and are deleted rather than weakened, because the
 * contract they guarded no longer exists: `measure` now emits
 * `w-full max-w-full` for all sixteen values, so a screen renders at whatever
 * width the shell gives it. The export's table — sixteen distinct widths from
 * 380px to 1340px, one per screen — is no longer expressed in the code, and
 * nothing can assert it back into being. `/signin`'s card measured 621px here
 * against the 440px the design draws.
 *
 *   - `every measure emits the class for half its pixel width` — false by
 *     construction now; every value emits the same class.
 *   - `no two measures render the same width` — all sixteen are identical.
 *     Worth recording that this one PASSED against the flattened map: it
 *     compared its own local table to itself and never called `screenClasses`,
 *     so it had been inert since it was written and would never have caught
 *     this. A test that cannot fail is not coverage.
 *
 * The `measure` prop and its sixteen keys are still the public API at eleven
 * call sites, so the vocabulary survives with nothing behind it. Restoring the
 * behaviour means restoring the map in `screenClasses.ts` and these two tests
 * together.
 */
describe("Screen", () => {
  test("bleed takes neither a measure nor padding — Review owns its own frame", () => {
    const classes = screenClasses({ placement: "bleed" });
    expect(classes).not.toMatch(/\bmax-w-/);
    expect(classes).not.toMatch(/\bp[xy]?-\d/);
  });

  test("a measured screen centres horizontally", () => {
    expect(screenClasses({ measure: "860" })).toContain("mx-auto");
  });

  /**
   * UPDATED BY THE 2026-08-01 RESKIN, and only the expected NUMBERS moved. The
   * mockup pads its sheet 30x36 where the export's ordinary screen was 28x32,
   * so every slot took the same +2 vertical / +4 horizontal step; the keys
   * still name the export's slot, because they are the prop's public values.
   * The claim under test is unchanged: the scale is a real scale on the 2px
   * base, and the default slot is the one the mockup actually draws.
   */
  test("the padding scale matches the mockup's sheet, on the 2px base", () => {
    expect(screenScroller({ pad: "28x32" })).toContain("lg:py-15");
    expect(screenScroller({ pad: "28x32" })).toContain("lg:px-18");
    expect(screenScroller({ pad: "32x40" })).toContain("lg:py-17");
    expect(screenScroller({ pad: "40" })).toContain("lg:p-22");
  });

  /**
   * THE DRAWN VALUE IS THE `lg` VALUE, and every slot has a smaller one below
   * it. Asserted as a pair because either half alone is a bug that looks fine
   * in review: a slot with no `lg:` has silently lost the mockup's padding at
   * full width, and a slot with only `lg:` has none at all on a narrow one.
   */
  test("every padding slot steps down below lg and restores the drawn value at lg", () => {
    for (const pad of ["28x32", "32x40", "26x30", "24x28", "36x40", "40"] as const) {
      const emitted = screenScroller({ pad });
      const base = emitted.match(/(?:^|\s)p[xy]?-\d+(?:\.\d+)?/g) ?? [];
      const wide = emitted.match(/lg:p[xy]?-\d+(?:\.\d+)?/g) ?? [];
      expect(base.length, `pad="${pad}" has no unprefixed padding, so a narrow window gets none`)
        .toBeGreaterThan(0);
      expect(wide.length, `pad="${pad}" has no lg: padding, so it never reaches the drawn value`)
        .toBe(base.length);
    }
  });

  /**
   * The export puts padding on the SCROLLER and the measure on an inner
   * wrapper. Collapsing them onto one element makes the padding eat the
   * measure — Queue's 860px column drew 796px of content, 32px short on each
   * side, and the error is invisible without measuring the box.
   */
  test("padding never eats the measure — they are different elements", () => {
    expect(screenClasses({ measure: "860" })).not.toMatch(/\bp[xy]?-\d/);
    expect(screenScroller({ pad: "28x32" })).not.toMatch(/\bmax-w-/);
  });

  /**
   * ONLY HALF OF CENTRING IS VISIBLE FROM HERE, AND THE VISIBLE HALF IS NOT THE
   * ONE THAT DECIDES IT.
   *
   * The scroller is a plain column, asserted below. The `m-auto` that would
   * centre a card in it lives in `Screen.tsx`, applied to a wrapper that also
   * carries `min-h-full` — and `min-h-full` stretches that wrapper to the full
   * height of the scroller, which leaves the auto margins no free space to
   * distribute. The result is that the six `placement="centre"` screens render
   * TOP-ALIGNED: measured on `/signin` at 1600x1000, the card sits 44px from the
   * top with 735px below it, where centred is 382/382.
   *
   * That is a deliberate acceptance, not an oversight — see the commit. It is
   * recorded here because this file is where someone will look when they notice
   * the sign-in card is not where the mockup puts it, and because no assertion
   * below will tell them: a cva config cannot see a class its consumer adds.
   * The E2E spec is the only place that could, and its centring test was
   * removed with the same decision.
   */
  test("the centred scroller is a plain column", () => {
    const scroller = screenScroller({ placement: "centre" });
    expect(scroller, "auto margins need a plain column to have free space in").toContain("flex-col");
    expect(
      scroller,
      "alignment-centring clamps an overflowing card flat against the pane, dropping the slot's padding",
    ).not.toMatch(/\bitems-center\b|\bjustify-center\b/);
  });

  test("pad has no cva default, so bleed can suppress it", () => {
    expect(
      screenScroller({ placement: "bleed" }),
      "a cva defaultVariant fires on undefined AND null, so it could never be suppressed for bleed",
    ).not.toMatch(/\bp[xy]?-\d/);
  });
});
