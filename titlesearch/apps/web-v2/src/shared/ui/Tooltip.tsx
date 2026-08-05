import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { ReactNode } from "react";
import { cn } from "./classNames";

/**
 * ⚠ THIS COMPONENT'S APPEARANCE IS NOT DRAWN. Flagged per BRIEF §12.
 *
 * The export has no tooltip. It has exactly three native `title=` attributes —
 * two on compare-matrix cells and one on a grid mark button — and every other
 * explanation in the design is rendered inline as a note beneath the control,
 * which is the better pattern and should stay the default.
 *
 * So the styling below is DERIVED, not observed: it borrows the menu's
 * treatment (panel surface, structural border, --shadow-menu), which is the
 * nearest thing the design does draw for a floating surface. It is a
 * defensible default, not a design decision — if a tooltip ever becomes
 * load-bearing, it needs drawing properly.
 *
 * Build it for the matrix-cell case only. A `title` on the grid mark button is
 * a stand-in for a legend that already exists on screen, and replacing that
 * with a real tooltip would make information available on hover that is
 * currently available always — a step backwards.
 *
 * Native `title` is not an acceptable substitute: it is not keyboard-reachable,
 * which §6 requires of every interactive element.
 */
export function Tooltip({
  content,
  children,
}: {
  /** Short text. Anything longer belongs inline, under the control. */
  content: ReactNode;
  children: ReactNode;
}) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={<span className="inline-flex" />}>
        {children}
      </BaseTooltip.Trigger>
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner sideOffset={6} className="z-(--z-overlay)">
          <BaseTooltip.Popup
            className={cn(
              "max-w-120 rounded-5 border border-line-strong bg-surface-panel",
              "px-5 py-3 text-xs text-ink-primary shadow-menu",
            )}
          >
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}

/**
 * Base UI shares one delay timer across all tooltips under a provider, so a
 * second tooltip opens instantly once the first has. Mount once, near the root.
 */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <BaseTooltip.Provider delay={400}>{children}</BaseTooltip.Provider>;
}
