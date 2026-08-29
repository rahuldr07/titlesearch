import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * ADAPTED FROM THE REGISTRY `scroll-area`. THIS IS THE PANE, AND IT IS THE
 * ONLY THING IN THE APP ALLOWED TO SCROLL.
 *
 * `styles.css` roots the app at `height:100%; overflow:hidden` on html, body
 * and #root, and says why: "A REVIEW TOOL IS NOT A DOCUMENT. The frame is one
 * viewport tall. Scrolling happens INSIDE panes, never on the page."
 * `INVARIANTS:60-65` carries the same thing five ways — the rail is a
 * full-height column, the order strip stays put, nothing collapses below its
 * own content, the page never scrolls sideways.
 *
 * That makes this component structural rather than cosmetic. A screen that
 * writes `overflow-y-auto` on a div by hand gets the scrolling and misses the
 * two constraints below it, which is how a pane ends up scrolling the frame.
 *
 * ══ min-h-0 IS THE WHOLE COMPONENT ══════════════════════════════════════════
 *
 * A flex child's default `min-height` is `auto`, which means "at least my
 * content" — so a scroll pane inside a flex column does not scroll, it GROWS,
 * pushing the frame past the viewport and handing the scrollbar to a body that
 * has `overflow:hidden`. The content below the fold then becomes unreachable by
 * any means. `INVARIANTS:64` ("nothing collapses below its own content") is the
 * same fact from the other end, and `min-h-0` plus `flex-1` is the pair that
 * satisfies both. It is one line and it is the reason this file exists.
 *
 * ══ THE SCROLLBAR IS NATIVE ═════════════════════════════════════════════════
 *
 * The registry's own comment says it: `scrollbar-width` and `scrollbar-color`
 * rather than a rendered track. That is kept and is right — a custom scrollbar
 * is a second scroll implementation to keep in sync with the keyboard, and a
 * pane in this app is routinely driven by J/K rather than by a pointer. Only
 * the colour changes: the registry pointed `scrollbar-color` at
 * `var(--color-border)`, a token this vocabulary does not have. It is
 * re-pointed at `--color-line-strong`, because a scrollbar is structural
 * furniture rather than control chrome. The bracket syntax stays — Tailwind has
 * no `scrollbar-*` utility of its own, and `check-rules.mjs` bans arbitrary
 * values carrying a LENGTH, which a keyword and a var reference are not.
 *
 * The registry's `focus-visible:ring-[3px] ring-ring/50` goes with it — a ring
 * width the design does not have, on a token this palette does not have. The
 * kit's own `tp-ring` draws the 2px accent outline every other primitive draws.
 *
 * ══ WHY IT IS FOCUSABLE AT ALL ══════════════════════════════════════════════
 *
 * WCAG 2.1 §2.1.1: a region that scrolls must be reachable and operable from
 * the keyboard, and a `<div>` with `overflow:auto` and no `tabIndex` is neither
 * in Safari or Firefox. So a scrollable pane is a tab stop with a visible ring.
 * `label` is required when it is one: `tabindex="0"` on an unnamed region is a
 * stop a screen-reader user lands on with nothing announced.
 *
 * The ring comes from `styles.css`'s `:where(…, [tabindex]):focus-visible`
 * rule, NOT from the kit's `tp-ring` utility. `tp-ring` keys off react-aria's
 * `data-focus-visible`, which only a react-aria composite sets — on a plain
 * `<div>` it is a class that matches nothing, which is the silent-no-op family
 * this kit keeps finding. This element is a native `[tabindex]`, so the global
 * selector already reaches it.
 */
export type ScrollAreaProps = {
  readonly children: ReactNode;
  /**
   * The region's accessible name, e.g. "Field rows". Required — this is a
   * keyboard-reachable landmark and an unnamed one is a dead stop.
   */
  readonly label: string;
  /**
   * `vertical` is the pane. `both` is for the evidence sheet, which is wider
   * than its column at 200% zoom. There is no `horizontal`: a pane that scrolls
   * sideways and not down is not a shape this design has.
   */
  readonly axis?: "vertical" | "both" | undefined;
  readonly className?: string | undefined;
};

export function ScrollArea({ children, label, axis = "vertical", className }: ScrollAreaProps) {
  return (
    <div
      data-slot="scroll-area"
      data-axis={axis}
      // A named, keyboard-operable scrollable region. `region` rather than
      // `group`: this is a landmark a reader can jump to by name.
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cx(
        // The pair. Neither works without the other inside a flex column.
        "min-h-0 flex-1",
        // NO `outline-none` here, and that is the point. `styles.css` draws the
        // ring from a `:where(…)` selector, which has ZERO specificity by
        // construction — so a single `outline-none` utility on this element
        // would delete the focus ring from a tab stop and leave the class
        // looking like a reset. The registry shipped exactly that.
        // Native chrome, in tokens. `line-strong` is the thumb because a
        // scrollbar is structural furniture, not control chrome.
        "[scrollbar-width:thin]",
        "[scrollbar-color:var(--color-line-strong)_transparent]",
        axis === "both" ? "overflow-auto" : "overflow-x-hidden overflow-y-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}
