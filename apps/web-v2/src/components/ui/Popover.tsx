import { Popover as AriaPopover, type PopoverProps } from "react-aria-components";
import { cx } from "./cx";

/**
 * THE POPOVER, AND THE ONE ATTRIBUTE THAT MAKES IT SAFE.
 *
 * `data-chord-scope="own"`. `shared/chords.ts` documents the bug this closes at
 * length: the reference prototype's global key handler guards on tagName, a
 * react-aria listbox is a `<div role="listbox">`, and `q` therefore both
 * escalates the open field AND typeahead-jumps the menu to "Quarantine". The
 * chord layer's escape hatch is a marked subtree, so EVERY overlay in this kit
 * carries the mark — Select, ComboBox, Menu, Dialog and this.
 *
 * It is set HERE, on the one component all of them portal through, rather than
 * at each call site. A mark that has to be remembered is a mark that will be
 * forgotten, and `chords.ts` calls this "the project's flagged bug factory".
 *
 * Note it also satisfies `overlayIsUp()`, whose second clause looks for the
 * same attribute so an overlay that is open but has not yet moved focus still
 * stands the global layer down. One frame is enough for a held key to repeat.
 *
 * MOTION comes from `tp-enter` (rule 10: 260ms cubic-bezier(.32,.72,0,1) on
 * entry), driven by react-aria's own data-entering/data-exiting. No JS
 * animation, and the exit is not cut short by unmount.
 *
 * WCAG 2.4.11 Focus Not Obscured: `offset` keeps the panel clear of its own
 * trigger, so a keyboard reader who opened it can still see what they opened.
 */
export type SurfacePopoverProps = Omit<PopoverProps, "className">;

export function Popover({ offset = 6, ...props }: SurfacePopoverProps) {
  return (
    <AriaPopover
      {...props}
      offset={offset}
      data-chord-scope="own"
      className={cx(
        "tp-enter rounded-md border border-line-strong bg-surface-panel shadow-card",
        // VERIFIED against the installed 1.20: react-aria exposes exactly two
        // custom properties on a popover, `--trigger-width` and
        // `--trigger-anchor-point`. There is no max-height variable, so the cap
        // is a spacing value (`max-h-160` = 320px on the 2px base) rather than
        // a var that resolves to nothing and silently uncaps the panel.
        "max-h-160 overflow-auto",
      )}
    />
  );
}
