import { ListBox, ListBoxItem, type ListBoxItemProps } from "react-aria-components";
import { cx } from "./cx";

/**
 * An option. Selection is drawn with a ✓ mark and weight, per rule 6's glyph
 * vocabulary (✓ ◆ • T1) — not with a tick icon from lucide and not with a
 * colour swap alone, which would fail a greyscale read.
 *
 * `children` is narrowed to ReactNode: react-aria also accepts a render
 * function, and allowing one here would let a caller replace the mark, which
 * is the single thing this wrapper exists to guarantee.
 *
 * NOTE ON `data-chord-scope`: it is deliberately NOT set here. It belongs on
 * the POPOVER (see Popover.tsx), because `overlayIsUp()` in `shared/chords.ts`
 * must see the mark from the moment the overlay opens — which is one frame
 * before this listbox receives focus, and `chords.ts` records that one frame is
 * enough for a held key to repeat.
 */
export type OptionProps = Omit<
  ListBoxItemProps<object>,
  "className" | "children" | "textValue"
> & {
  /** Plain text. Doubles as the typeahead string — see `textValue` below. */
  readonly children: string;
};

export function Option({ children, ...props }: OptionProps) {
  return (
    <ListBoxItem
      {...props}
      /*
       * REQUIRED, and react-aria says so out loud: wrapping the label in a
       * mark span makes the children non-plain-text, and RAC can then no longer
       * infer the typeahead string. Without this, typing "qu" in an open list
       * matches nothing — which is worse here than elsewhere, because
       * `shared/chords.ts` has just STOOD THE GLOBAL VOCABULARY DOWN on the
       * promise that this widget owns those keys. Both layers would ignore the
       * keystroke.
       *
       * Constraining `children` to `string` is what makes this derivable rather
       * than another prop a caller can forget.
       */
      textValue={children}
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
