import type { ReactNode } from "react";
import { ListBox, ListBoxItem, type ListBoxItemProps } from "react-aria-components";
import { cx } from "./cx";

/**
 * The option list shared by Select and ComboBox, so the two cannot drift into
 * two different hover states for the same gesture.
 *
 * NOTE ON `data-chord-scope`: it is NOT set here. It belongs on the POPOVER
 * (see Popover.tsx), because `overlayIsUp()` in `shared/chords.ts` must see the
 * mark from the moment the overlay opens — which is one frame before the
 * listbox receives focus, and one frame is enough for a held key to repeat.
 * Marking the listbox instead would leave that frame open.
 */
export const listBoxClass = "flex flex-col gap-1 p-3 outline-none";

/**
 * An option. Selection is drawn with a ✓ mark and weight, per rule 6's glyph
 * vocabulary (✓ ◆ • T1) — not with a tick icon from lucide and not with a
 * colour swap alone, which would fail a greyscale read.
 *
 * `children` is narrowed to ReactNode: react-aria also accepts a render
 * function, and allowing one here would let a caller replace the mark, which
 * is the single thing this wrapper exists to guarantee.
 */
export type OptionProps = Omit<ListBoxItemProps<object>, "className" | "children"> & {
  readonly children: ReactNode;
};

export function Option({ children, ...props }: OptionProps) {
  return (
    <ListBoxItem
      {...props}
      className={cx(
        "tp-state tp-target flex cursor-pointer items-center gap-4 rounded-sm px-6 py-4",
        "font-sans text-body leading-close text-ink-primary outline-none",
        // react-aria's own attributes. `data-focused` is keyboard OR pointer
        // hover inside a listbox, which is the behaviour a menu wants.
        "data-focused:bg-surface-sunken",
        "data-selected:font-semibold",
        "data-disabled:cursor-not-allowed data-disabled:text-ink-disabled",
      )}
    >
      {({ isSelected }) => (
        <>
          <span aria-hidden className="w-8 shrink-0 text-ink-muted">
            {isSelected ? "✓" : ""}
          </span>
          {children}
        </>
      )}
    </ListBoxItem>
  );
}

export { ListBox };
