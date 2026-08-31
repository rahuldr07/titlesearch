import type { ReactNode } from "react";
import {
  DialogTrigger,
  Heading,
  Popover as PopoverPrimitive,
  type DialogTriggerProps,
  type PopoverProps,
} from "react-aria-components";

import { cx } from "./cx";
import { chordOverlay, overlayCap, overlaySurface } from "./overlaySurface";

/**
 * The popover carries `data-chord-scope="own"` here, on the one component
 * every anchored overlay portals through, rather than at each call site — a
 * mark that has to be remembered is a mark that will be forgotten. It sits
 * on the popover, not the listbox inside it, because overlayIsUp() must see
 * it from the moment the panel mounts — one frame before focus reaches the
 * first option, and one frame is enough for a held key to repeat.
 *
 * WCAG 2.4.11 Focus Not Obscured: `offset` keeps the panel clear of its own
 * trigger, so a keyboard reader who opened it can still see what they opened.
 */
export type SurfacePopoverProps = Omit<PopoverProps, "className"> & {
  /**
   * "trigger" sizes the panel to react-aria's `--trigger-width` — the width
   * of the control that opened it. Without a width rule an absolutely
   * positioned panel stretches to its positioning container, which for a
   * low-on-the-page combobox meant a viewport-wide listbox.
   */
  readonly width?: "natural" | "trigger";
};

export function Popover({ offset = 6, width = "natural", ...props }: SurfacePopoverProps) {
  return (
    <PopoverPrimitive
      {...props}
      {...chordOverlay}
      offset={offset}
      data-slot="popover"
      className={cx(
        overlaySurface,
        overlayCap,
        "tp-z-popup",
        width === "trigger" && "w-(--trigger-width)",
      )}
    />
  );
}

/** The trigger half. Re-exported so a screen imports one module, not two. */
export function PopoverTrigger({ children, ...props }: DialogTriggerProps) {
  return (
    <DialogTrigger data-slot="popover-trigger" {...props}>
      {children}
    </DialogTrigger>
  );
}

/**
 * The panel's header row: 11px w700, sentence case, on control-fill with a
 * hairline beneath. Ink-muted rather than ink-faint — overlaySurface.ts has
 * the contrast numbers. No border, radius or shadow of its own: a band
 * inside the popover's surface, since nested cards are forbidden.
 */
export function PopoverHeader({ children }: { readonly children: ReactNode }) {
  return (
    <div
      data-slot="popover-header"
      className="border-b border-line-subtle bg-control-fill px-8 py-5"
    >
      {children}
    </div>
  );
}

/** The 11px label rung, sentence case. */
export function PopoverTitle({ children }: { readonly children: ReactNode }) {
  return (
    <Heading
      slot="title"
      data-slot="popover-title"
      className="font-sans text-label leading-flat font-bold text-ink-muted"
    >
      {children}
    </Heading>
  );
}

/** Body prose. 13px, the meta rung — a popover explains, it does not narrate. */
export function PopoverDescription({ children }: { readonly children: ReactNode }) {
  return (
    <div
      data-slot="popover-description"
      className="px-8 py-6 font-sans text-meta leading-body text-ink-secondary"
    >
      {children}
    </div>
  );
}
