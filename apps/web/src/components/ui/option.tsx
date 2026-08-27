import {
  ListBoxItem,
  type ListBoxItemProps,
} from "react-aria-components";

import { BlockedHint } from "./blockedHint";
import { disabledAttributes, type Disablement } from "./disabled";
import { collectionItem, markGutter } from "./overlaySurface";

/**
 * An option. Selection is drawn with a ✓ MARK and weight, per rule 6's glyph
 * vocabulary — not with a lucide `CheckIcon` (which the registry used) and not
 * with a colour swap alone, which fails a greyscale read.
 */
export type OptionProps = Omit<
  ListBoxItemProps<object>,
  "className" | "children" | "textValue" | "isDisabled"
> &
  Disablement & {
    /** Plain text. Doubles as the typeahead string — see `textValue` below. */
    readonly children: string;
  };

export function Option({ children, disabledBecause, ...props }: OptionProps) {
  return (
    <BlockedHint reason={disabledBecause}>
      <ListBoxItem
        {...props}
        {...disabledAttributes(disabledBecause)}
        /*
         * REQUIRED, and react-aria says so out loud: wrapping the label in a mark
         * span makes the children non-plain-text, and RAC can then no longer
         * infer the typeahead string. Without this, typing "qu" in an open list
         * matches nothing — worse here than elsewhere, because `chords.ts` has
         * just STOOD THE GLOBAL VOCABULARY DOWN on the promise that this widget
         * owns those keys. Both layers would ignore the keystroke.
         */
        textValue={children}
        data-slot="select-item"
        className={collectionItem}
      >
        {({ isSelected }) => (
          <>
            <span aria-hidden className={markGutter}>
              {isSelected ? "✓" : ""}
            </span>
            {children}
          </>
        )}
      </ListBoxItem>
    </BlockedHint>
  );
}
