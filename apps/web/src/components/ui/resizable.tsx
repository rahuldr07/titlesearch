import type { ReactNode } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { cx } from "./cx";
import { chordWidget } from "./overlaySurface";

/**
 * The examination workstation split (drag divider, 38–74%). The band is
 * expressed as the left panel's minSize/maxSize rather than left to a caller.
 *
 * There is deliberately no hand-rolled arrow handler: react-resizable-panels
 * ships the WCAG 2.2 §2.5.7 keyboard alternative (arrows at ±5%, Home/End,
 * Enter, F6), and a second handler on the same element double-steps every
 * press. Clamping is the solver's, so Home/End land on 38/74 rather than
 * 0/100.
 *
 * The chord mark is `widget`, on the separator: `own` is read document-wide,
 * so a permanently-mounted element carrying it kills every chord in the app;
 * and focusOwnsKeys matches with closest(), so on the group the mark would
 * stand the chords down whenever focus was in either panel — including the
 * field rows, where J/K must work.
 */

export type SplitProps = {
  readonly children: ReactNode;
  /** `horizontal` is the workstation: two columns, a vertical divider. */
  readonly orientation?: "horizontal" | "vertical" | undefined;
  readonly className?: string | undefined;
};

/** The group. Fills its parent and never scrolls — the panes do (ScrollArea). */
export function Split({ children, orientation = "horizontal", className }: SplitProps) {
  return (
    <Group data-slot="split" orientation={orientation} className={cx("flex h-full min-h-0 w-full", className)}>
      {children}
    </Group>
  );
}

/* The 38–74% band lives in `splitBand.ts` — Fast Refresh cannot hot-swap a
   module exporting both a component and a constant. Applied to the left
   panel; the right is whatever remains, so the two cannot disagree. */

export type SplitPanelProps = {
  readonly children: ReactNode;
  /** Percent of the panels' shared space, e.g. "50". Unitless = percentage. */
  readonly defaultSize?: string | undefined;
  readonly minSize?: string | undefined;
  readonly maxSize?: string | undefined;
  readonly className?: string | undefined;
};

export function SplitPanel({ children, defaultSize, minSize, maxSize, className }: SplitPanelProps) {
  return (
    <Panel
      data-slot="split-panel"
      {...(defaultSize !== undefined ? { defaultSize } : {})}
      {...(minSize !== undefined ? { minSize } : {})}
      {...(maxSize !== undefined ? { maxSize } : {})}
      className={cx("flex min-h-0 min-w-0 flex-col", className)}
    >
      {children}
    </Panel>
  );
}

/**
 * The divider. A tab stop with a name, a ring and the library's arrow keys.
 *
 * `tp-state`, not `tp-move`: the handle's colour settles in 140ms while the
 * PANELS travel at whatever rate the pointer does. A transition on the widths
 * would lag the cursor, which reads as the divider being stuck.
 */
export function SplitHandle({ label }: { readonly label: string }) {
  return (
    <Separator
      {...chordWidget}
      data-slot="split-handle"
      aria-label={label}
      className={cx(
        // 24px of target, no fill. `tp-target` supplies the WCAG 2.5.8 floor;
        // the visible divider is the hairline child below, so the hit area can
        // be generous without the design gaining a 24px grey band.
        "tp-state tp-target group relative flex shrink-0 cursor-col-resize items-center justify-center",
        // No `outline-none`. The separator is a native `[tabindex]`, so
        // `styles.css`'s zero-specificity `:where(…):focus-visible` rule draws
        // the 2px accent ring — and a single reset utility would delete it.
        "bg-transparent focus-visible:bg-action-surface",
        "aria-[orientation=horizontal]:cursor-row-resize",
      )}
    >
      {/* The divider itself, as a hairline. `group-hover` darkens it a tier,
          so the handle answers the pointer without anything moving under it. */}
      <span
        aria-hidden
        className={cx(
          "tp-state bg-line-strong group-hover:bg-control-border",
          "h-full w-px",
          "group-aria-[orientation=horizontal]:h-px group-aria-[orientation=horizontal]:w-full",
        )}
      />
    </Separator>
  );
}
