import type { ReactNode } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { cx } from "./cx";
import { chordWidget } from "./overlaySurface";

/**
 * ADAPTED FROM THE REGISTRY `resizable`. THE §7 EXAMINATION WORKSTATION SPLIT.
 *
 * Design README §7: "split pane (drag divider, 38–74%)". Left is the decision
 * column, right the evidence pane. The band is the design's, expressed as the
 * LEFT panel's `minSize`/`maxSize` rather than left to a caller: 20% gives an
 * evidence pane too narrow for a citation box and a column too narrow for a
 * 28px value.
 *
 * ══ WCAG 2.2 §2.5.7 (DRAGGING MOVEMENTS) IS SATISFIED BY THE LIBRARY, AND
 *    THAT WAS CHECKED IN ITS SOURCE RATHER THAN ASSUMED ═════════════════════
 *
 * §2.5.7 wants a single-pointer, non-drag alternative to any drag. A
 * hand-rolled arrow handler was written and then DELETED: react-resizable-
 * panels 4.12.3 ships one, and a second on the same element double-steps every
 * press. Verified in the installed bundle rather than in the docs — the
 * separator is a tab stop (`:2243`) with a keydown listener (`:1517`) carrying
 * ArrowLeft/Right at ±5% (`:1126`), Home/End (`:1173`, `:1138`), Enter to
 * collapse and F6 to the next separator.
 *
 * Clamping is the solver's, so Home/End land on 38% and 74% rather than 0/100
 * — `resizable.a11y.stories.tsx` measures exactly that. So the handle needs
 * neither a hint nor a button. What it DOES need is a ring and a name, and the
 * registry gave neither: `ring-ring` is not a token here, and with no
 * `aria-label` a keyboard user landed on an unnamed tab stop. Hence `label`.
 *
 * ══ THE CHORD MARK IS `widget`, AND ON THE SEPARATOR ════════════════════════
 *
 * `focusRoles.ts` is emphatic: `own` is read DOCUMENT-WIDE by `overlayIsUp()`,
 * so anything permanently mounted carrying it kills every chord in the app
 * forever, and this split is on screen at all times. `widget` is read only
 * against the active element's ancestors — exactly the question here: while the
 * handle holds focus the arrows are its own, or one keypress both resizes and
 * jumps a field. It goes on the SEPARATOR and not the group because
 * `focusOwnsKeys` matches with `closest()`, and on the group it would stand the
 * chords down whenever focus was in either panel — including the field rows,
 * which is precisely where J/K must work.
 *
 * ══ WHAT ELSE THE REGISTRY GAVE US THAT WENT ═══════════════════════════════
 *
 *   - `bg-border` / `ring-offset-background` / `ring-ring` — three tokens this
 *     vocabulary does not have, on the two elements it drew.
 *   - `w-px` plus an `after:` pseudo widening the hit area to 4px: WCAG 2.5.8's
 *     24px minimum, missed by 20. The handle is now 24px and TRANSPARENT,
 *     drawing a centred hairline — the target is the element, the divider is
 *     what you see. The 24 is `tp-target`'s and was MEASURED at 24 in a probe
 *     rather than assumed: a `w-3` here is silently widened, because
 *     `tp-target` sets `min-inline-size` on anything without a `min-w-`.
 *   - `rounded-lg` on the 4x24px grip (a 14px radius on a 4px box is a
 *     lozenge), and `[&[aria-orientation=horizontal]>div]:rotate-90`, which
 *     rotated a symmetrical grip. The grip is gone; a hairline needs none.
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

/* The design's 38–74% band lives in `splitBand.ts` — rule 11's one variable,
   and split out because Fast Refresh cannot hot-swap a module exporting both a
   component and a constant. Applied to the LEFT panel; the right is whatever
   remains, so the two cannot disagree. */

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
        // 24px of TARGET, no fill. `tp-target` supplies the WCAG 2.5.8 floor on
        // both axes; the visible divider is the hairline child below, so the
        // hit area can be generous without the design gaining a 24px grey band.
        "tp-state tp-target group relative flex shrink-0 cursor-col-resize items-center justify-center",
        // No `outline-none`. The separator is a native `[tabindex]`, so
        // `styles.css`'s zero-specificity `:where(…):focus-visible` rule draws
        // the 2px accent ring — and a single reset utility would delete it.
        "bg-transparent focus-visible:bg-action-surface",
        "aria-[orientation=horizontal]:cursor-row-resize",
      )}
    >
      {/* THE DIVIDER ITSELF. A hairline: design elevation says depth separates
          a surface from the canvas and hairlines divide inside it, never both.
          `group-hover` darkens it a tier, so the handle answers the pointer
          without anything moving under it. */}
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
