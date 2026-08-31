import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * The pane — the only thing in the app allowed to scroll. The frame is one
 * viewport tall; a screen that writes `overflow-y-auto` on a div by hand
 * gets the scrolling and misses the constraints below.
 *
 * `min-h-0` plus `flex-1` is the whole component: a flex child's default
 * `min-height: auto` means "at least my content", so a scroll pane inside a
 * flex column grows past the viewport instead of scrolling, and content
 * below the fold becomes unreachable by any means.
 *
 * A div with overflow:auto and no tabIndex is unscrollable from the keyboard
 * in Safari and Firefox (WCAG 2.1 §2.1.1), so the pane is a named tab stop.
 * The ring comes from styles.css's `:where(…, [tabindex]):focus-visible`
 * rule, not from `tp-ring` — that utility keys off react-aria's
 * `data-focus-visible`, which a plain div never sets.
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
        // No `outline-none` here: styles.css draws the ring from a
        // zero-specificity `:where(…)` selector, so a single reset utility on
        // this element would silently delete the focus ring from a tab stop.
        // `line-strong` is the thumb — structural furniture, not control
        // chrome.
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
