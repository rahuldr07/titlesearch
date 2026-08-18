import { cva } from "class-variance-authority";

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
