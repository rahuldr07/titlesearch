import { describe, expect, test } from "vitest";
import { paneClasses } from "./Pane";
import { screenClasses, screenScroller } from "./Screen";

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
 * The export's own measures, read off `TitlePipe.dc.html` — the `max-width` on
 * each screen body's inner wrapper. Expressed here in PIXELS because that is
 * how the design states them; the component converts to the 2px spacing base,
 * where `max-w-430` is 860px.
 */
const MEASURES = {
  "380": "max-w-190",
  "420": "max-w-210",
  "440": "max-w-220",
  "460": "max-w-230",
  "560": "max-w-280",
  "640": "max-w-320",
  "700": "max-w-350",
  "720": "max-w-360",
  "860": "max-w-430",
  "880": "max-w-440",
  "900": "max-w-450",
  "940": "max-w-470",
  "1040": "max-w-520",
  "1120": "max-w-560",
  "1160": "max-w-580",
  "1340": "max-w-670",
} as const;

describe("Screen", () => {
  test("every measure emits the class for half its pixel width", () => {
    for (const [measure, expected] of Object.entries(MEASURES)) {
      const classes = screenClasses({ measure: measure as keyof typeof MEASURES });
      expect(classes, `measure="${measure}" must emit ${expected}`).toContain(expected);
    }
  });

  test("no two measures render the same width", () => {
    const seen = new Map<string, string>();
    for (const measure of Object.keys(MEASURES)) {
      const emitted = MEASURES[measure as keyof typeof MEASURES];
      const clash = seen.get(emitted);
      expect(clash, `measure ${measure} renders identically to ${clash}`).toBeUndefined();
      seen.set(emitted, measure);
    }
  });

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
    expect(screenScroller({ pad: "28x32" })).toContain("py-15");
    expect(screenScroller({ pad: "28x32" })).toContain("px-18");
    expect(screenScroller({ pad: "32x40" })).toContain("py-17");
    expect(screenScroller({ pad: "40" })).toContain("p-22");
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

  test("pad has no cva default, so bleed can suppress it", () => {
    expect(
      screenScroller({ placement: "bleed" }),
      "a cva defaultVariant fires on undefined AND null, so it could never be suppressed for bleed",
    ).not.toMatch(/\bp[xy]?-\d/);
  });
});
