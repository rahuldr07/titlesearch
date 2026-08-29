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
 * THE POPOVER, AND THE ONE ATTRIBUTE THAT MAKES IT SAFE.
 *
 * `data-chord-scope="own"`. `shared/chords.ts` documents the bug it closes:
 * the reference prototype's global key handler guarded on tagName, a
 * react-aria listbox is a `<div role="listbox">`, and `q` therefore both
 * escalated the open field AND typeahead-jumped the menu to "Quarantine".
 *
 * It is set HERE, on the one component every anchored overlay portals through,
 * rather than at each call site. A mark that has to be remembered is a mark
 * that will be forgotten — `chords.ts` calls this "the project's flagged bug
 * factory".
 *
 * The mark is on the POPOVER, not on the listbox inside it, because
 * `overlayIsUp()` must see it from the moment the panel mounts — one frame
 * before focus reaches the first option, and `chords.ts` records that one
 * frame is enough for a held key to repeat.
 *
 * ADAPTED FROM THE REGISTRY: `bg-popover` → `bg-surface-panel`,
 * `border-border` → `border-line-strong`, `rounded-md`(8) → `rounded-lg`(14,
 * rule 5's surface rung), `z-50` → `z-popup`, and the registry's
 * `animate-in/fade-in-0/zoom-in-95` stack → `tp-enter` (rule 10: 260ms
 * cubic-bezier(.32,.72,0,1), nothing bounces).
 *
 * WCAG 2.4.11 Focus Not Obscured: `offset` keeps the panel clear of its own
 * trigger, so a keyboard reader who opened it can still see what they opened.
 */
export type SurfacePopoverProps = Omit<PopoverProps, "className">;

export function Popover({ offset = 6, ...props }: SurfacePopoverProps) {
  return (
    <PopoverPrimitive
      {...props}
      {...chordOverlay}
      offset={offset}
      data-slot="popover"
      className={cx(overlaySurface, overlayCap, "tp-z-popup")}
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
 * The panel's header row. THE CARD RECIPE, and it is the card recipe on
 * purpose: 11px w700, sentence case, on `--color-control-fill`
 * with a `--color-line-subtle` hairline beneath.
 *
 * The ink is `--color-ink-muted` rather than the recipe's `--color-ink-faint`;
 * `overlaySurface.ts` measures why, and it is a reported deviation.
 *
 * NESTED CARDS ARE FORBIDDEN (RECIPES.md §Card), so this header has no border,
 * no radius of its own and no shadow — it is a BAND inside the popover's own
 * surface, not a card sitting on one. The registry's PopoverHeader was a
 * padded div with nothing distinguishing it; the recipe is what makes it read.
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

/** Rule 2: the 11px label rung. Rule 4: sentence case, so no `uppercase`. */
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
