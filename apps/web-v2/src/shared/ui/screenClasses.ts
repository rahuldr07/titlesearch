import { cva } from "class-variance-authority";

/**
 * A screen body: its scroller, its measure, its padding, its placement.
 *
 * THE MEASURE BELONGS TO THE SCREEN, NOT THE SHELL. The export gives each of
 * its eighteen screens its own `max-width` — sixteen distinct values from 380px
 * to 1340px — because a sign-in card and a seven-column lifecycle board want
 * opposite things. The shell previously imposed one 1440px cap and 18px of
 * padding on all of them, so eight screens ran to the window edge while the
 * export held a column, and every screen was padded at roughly half the drawn
 * amount.
 *
 * Worse, the shell centred with `mx-auto` on a `flex-1` flex item. Auto inline
 * margins cancel `align-self:stretch`, so `main` sized shrink-to-fit: Queue
 * asked for 860px and rendered 670px, and Profile — which set no measure —
 * collapsed to its content's natural 421px where the export draws 720px. No
 * viewport-width guard can catch that; the binding constraint is the container.
 * The measure therefore lives here, on a full-width parent.
 *
 * VARIANTS ARE KEYED BY THE EXPORT'S OWN PIXEL NUMBERS so a call site can be
 * checked against the design table on sight. Invented names (`roster`,
 * `ledger`) would need a lookup nobody performs, and a wrong one would be
 * invisible in review. Widths halve because the spacing base is 2px:
 * `max-w-430` is 860px.
 */
/**
 * PADDING SITS OUTSIDE THE MEASURE, on the scroller — exactly as the export
 * spells it:
 *
 *     <div style="height:100%;overflow:auto;padding:28px 32px">   ← scroller
 *       <div style="max-width:860px;margin:0 auto">               ← measure
 *
 * Putting both on one element makes the padding eat into the measure: Queue's
 * 860px column drew 796px of content because 32px went from each side. The two
 * cva configs below keep the axes separate, so a measure means the width of the
 * CONTENT, which is what the design table states.
 *
 * THE KEY NAMES THE EXPORT'S SLOT; THE VALUE IS WHAT THE RESKIN DRAWS IN IT.
 * The 2026-08-01 mockup pads its sheet `30px 36px` (`.qmain`, `.amain`) where
 * the export's ordinary screen was `28x32`, so every slot takes that same
 * +2 vertical / +4 horizontal step and the export's per-screen ORDERING — which
 * is a real design fact, a lifecycle board is not padded like a sign-in card —
 * survives intact. The keys are deliberately NOT renamed to the drawn numbers:
 * they are the prop's public values at eleven call sites in eight features this
 * reskin does not own, and renaming them would turn a restyle into a
 * cross-boundary refactor whose only benefit is that a string matches. The
 * measures below are untouched for the same reason they always were — the
 * export's widths are not what this reskin changes.
 */
export const screenScroller = cva("", {
  variants: {
    pad: {
      /** the export's ordinary screen → the mockup's sheet, 30x36 */
      "28x32": "py-10 px-12 lg:py-15 lg:px-18",
      "32x40": "py-12 px-14 lg:py-17 lg:px-22",
      "26x30": "py-8 px-10 lg:py-14 lg:px-17",
      "24x28": "py-8 px-10 lg:py-13 lg:px-16",
      "36x40": "py-12 px-14 lg:py-19 lg:px-22",
      /** the six centred single-card screens; one symmetric value, so +4 */
      "40": "p-14 lg:p-22",
    },
    /**
     * `centre` — the six single-card screens the export centres on BOTH axes
     * (`display:flex;align-items:center;justify-content:center`). `top` needs
     * nothing here; the inner wrapper's `mx-auto` does the horizontal work,
     * which is how the export spells it too (`margin:0 auto`).
     */
    placement: {
      top: "",
      centre: "flex flex-col",
      bleed: "overflow-hidden",
    },
  },
  defaultVariants: { placement: "top" },
});

export const screenClasses = cva("", {
  variants: {
    /** The export's `max-width`, in pixels, on each screen body's wrapper.
     * Updated to be fluid and scale properly on laptops. */
    measure: {
      "380": "w-full max-w-full",
      "420": "w-full max-w-full",
      "440": "w-full max-w-full",
      "460": "w-full max-w-full",
      "560": "w-full max-w-full",
      "640": "w-full max-w-full",
      "700": "w-full max-w-full",
      "720": "w-full max-w-full",
      "860": "w-full max-w-full",
      "880": "w-full max-w-full",
      "900": "w-full max-w-full",
      "940": "w-full max-w-full",
      "1040": "w-full max-w-full",
      "1120": "w-full max-w-full",
      "1160": "w-full max-w-full",
      "1340": "w-full max-w-full",
    },
    /**
     * `top` — the export's `margin:0 auto`, on twelve screens.
     * `centre` — the inner card of a both-axes-centred screen; the scroller
     * does the centring, so this only needs its width.
     * `bleed` — Review, which draws its own two-pane frame and must reach the
     * pane edges.
     */
    placement: {
      top: "mx-auto w-full",
      centre: "w-full",
      bleed: "h-full",
    },
  },
  defaultVariants: { placement: "top" },
});
