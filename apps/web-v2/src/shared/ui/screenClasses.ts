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
/**
 * THE DRAWN PADDING IS THE `lg` PADDING, not the only padding. Below `lg` the
 * same 30x36 sheet spends 72px of a shrinking column on margin before any
 * content is laid out. Every slot keeps its DRAWN value at `lg` and up and
 * steps down below it; the ORDERING holds at both ends, because that ordering
 * is the design fact — a lifecycle board is not padded like a sign-in card at
 * any width.
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
     *
     * IT IS A COLUMN AND AN `m-auto` CHILD, NOT `items-center justify-center`,
     * for a reason that only shows on a window too short for the card. The
     * textbook argument against alignment-centring — that it overflows both
     * ways and the top becomes unreachable — DOES NOT APPLY HERE: current
     * Chrome and Firefox clamp an overflowing flex item to the start edge, and
     * measuring `/signin` at 900x240 confirmed it (top at +2px, not negative).
     * What was measured instead is smaller and real: that clamp lands the card
     * against the pane, at +2px of the 28px `p-14` this slot draws, because it
     * is the ITEM being clamped and the padding is not part of the item. Auto
     * margins resolve to 0 in the same case and the padding survives — measured
     * +28px. With free space they centre exactly as alignment did (382px above
     * and below at 1600x1000). The child half is `m-auto` in `screenClasses`
     * below; both are required, and either alone is inert.
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
    /**
     * The export's `max-width`, in pixels, on each screen body's wrapper.
     *
     * THESE ARE NOT WHAT MAKES A NARROW WINDOW CRAMPED, and flattening them to
     * `max-w-full` is the fix to refuse. `max-width` is a CAP, not a floor:
     * with the `w-full` every placement already sets, a 1340px measure takes
     * 1340px where there is room and shrinks where there is not, so it cannot
     * overflow anything. What it CAN do is hold a 380px sign-in card to 380px
     * on a 1600px window — the entire reason the table exists. Collapsing it
     * does not widen a cramped screen; it destroys the measure on a roomy one.
     * Padding and the flex minimums are the levers that move at small widths.
     */
    measure: {
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
    },
    /**
     * `top` — the export's `margin:0 auto`, on twelve screens.
     * `centre` — the inner card of a both-axes-centred screen. `m-auto` is the
     * child half of the pair documented on `screenScroller`'s `centre` above:
     * it centres on both axes while free space exists and resolves to 0 when
     * the card outgrows the window, which is what keeps the slot's padding
     * around a card the alignment version pinned flat against the pane.
     * `bleed` — Review, which draws its own two-pane frame and must reach the
     * pane edges.
     */
    placement: {
      top: "mx-auto w-full",
      centre: "m-auto w-full",
      bleed: "h-full",
    },
  },
  defaultVariants: { placement: "top" },
});
