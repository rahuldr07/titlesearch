import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "./classNames";
import { PaneBody } from "./Pane";

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
/* eslint-disable-next-line react-refresh/only-export-components -- exported so the sixteen measures are provable as a pure function in the node gate; a wrong or missing one renders a screen at the shell's full width, which no render test asserts. */
export const screenScroller = cva("", {
  variants: {
    pad: {
      /** the export's ordinary screen → the mockup's sheet, 30x36 */
      "28x32": "py-15 px-18",
      "32x40": "py-17 px-22",
      "26x30": "py-14 px-17",
      "24x28": "py-13 px-16",
      "36x40": "py-19 px-22",
      /** the six centred single-card screens; one symmetric value, so +4 */
      "40": "p-22",
    },
    /**
     * `centre` — the six single-card screens the export centres on BOTH axes
     * (`display:flex;align-items:center;justify-content:center`). `top` needs
     * nothing here; the inner wrapper's `mx-auto` does the horizontal work,
     * which is how the export spells it too (`margin:0 auto`).
     */
    placement: {
      top: "",
      centre: "flex items-center justify-center",
      bleed: "overflow-hidden",
    },
  },
  defaultVariants: { placement: "top" },
});

/* eslint-disable-next-line react-refresh/only-export-components -- exported so the sixteen measures are provable as a pure function in the node gate; a wrong or missing one renders a screen at the shell's full width, which no render test asserts. */
export const screenClasses = cva("", {
  variants: {
    /** The export's `max-width`, in pixels, on each screen body's wrapper. */
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

type MeasureVariants = VariantProps<typeof screenClasses>;
type ScrollerVariants = VariantProps<typeof screenScroller>;

export type ScreenMeasure = NonNullable<MeasureVariants["measure"]>;
export type ScreenPad = NonNullable<ScrollerVariants["pad"]>;
export type ScreenPlacement = NonNullable<MeasureVariants["placement"]>;

export interface ScreenProps {
  children: ReactNode;
  /** Omitted only when `placement` is `bleed`. */
  measure?: ScreenMeasure;
  /** Defaults to `28x32`, the export's value on twelve of the eighteen. */
  pad?: ScreenPad;
  placement?: ScreenPlacement;
  className?: string;
}

/**
 * The scroller is `PaneBody`'s, not a second one. A screen that grew its own
 * `overflow-y-auto` beside the pane's would produce two nested scrollbars, and
 * the outer one would be the page — the exact failure this replaces.
 */
export function Screen({ measure, pad, placement, children, className }: ScreenProps) {
  const bleed = placement === "bleed";
  return (
    <PaneBody className={screenScroller({ pad: bleed ? undefined : (pad ?? "28x32"), placement })}>
      <div className={cn(screenClasses({ measure, placement }), className)}>{children}</div>
    </PaneBody>
  );
}
