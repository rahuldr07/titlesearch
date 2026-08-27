import type { ReactNode } from "react";
import {
  TooltipTrigger,
  Tooltip as AriaTooltip,
  type TooltipProps as AriaTooltipProps,
} from "react-aria-components";
import { cx } from "./cx";

/**
 * A TOOLTIP IS NEVER THE ONLY PLACE A FACT LIVES.
 *
 * WCAG 2.2 and this app's own rule 9 both push the same way: a hover-only
 * message is unavailable to touch, and often to a screen reader. So a disabled
 * control in this kit states its reason INLINE (see `disabled.ts` and
 * `FieldShell`) and a tooltip only ever repeats or elaborates.
 *
 * react-aria's TooltipTrigger handles the parts that are usually got wrong:
 * it opens on keyboard focus as well as hover, it does not open on touch (where
 * it would be a trap), and it wires `aria-describedby` so the text is announced
 * rather than merely drawn.
 *
 * `delay` is left at react-aria's default rather than set to 0: a tooltip that
 * fires instantly flickers along a toolbar as the pointer crosses it.
 */
export type TooltipProps = Omit<AriaTooltipProps, "className" | "children"> & {
  readonly children: ReactNode;
};

export function Tooltip({ offset = 6, children, ...props }: TooltipProps) {
  return (
    <AriaTooltip
      {...props}
      offset={offset}
      className={cx(
        "tp-enter z-popup max-w-160 rounded-sm border border-line-strong bg-rail-surface px-6 py-4",
        // The rail family, because this is dark chrome floating over the app
        // and `--color-ink-primary` on `--color-rail-surface` is 1.03:1 —
        // invisible, not merely low (tokens.css).
        "font-sans text-meta leading-close text-rail-ink shadow-card",
      )}
    >
      {children}
    </AriaTooltip>
  );
}

export { TooltipTrigger };
