import {
  ListBoxItem,
  type ListBoxItemProps,
} from "react-aria-components";

import { disabledAttributes, type Disablement } from "./disabled";
import { collectionItem, markGutter } from "./overlaySurface";

/**
 * An option. Selection is drawn with a ✓ MARK and weight, per rule 6's glyph
 * vocabulary — not with a lucide `CheckIcon` (which the registry used) and not
 * with a colour swap alone, which fails a greyscale read.
 *
 * ══ NO `BlockedHint`, AND THIS ONE IS MEASURED ══════════════════════════════
 *
 * `ListBox` builds its items through a COLLECTION BUILDER, which walks the JSX
 * children looking for `ListBoxItem`. A wrapper element between the two makes
 * the builder stop seeing the item, and it is dropped — not hidden, DROPPED.
 * Probed with one live and one blocked option:
 *
 *     Option (wrapped)   options rendered: 1  -> ['Live option']
 *
 * A blocked option vanished. Rule 12 says a blocked action renders disabled
 * WITH THE RULE, never hidden, and a reviewer choosing an absence state could
 * not see that a state existed and was barred.
 *
 * The blast radius is narrower than it looks, and that matters because the
 * previous comment on `toggle-group.tsx` claimed the opposite. Probed, same
 * shape, all four group controls:
 *
 *     Segment (wrapped)             2 of 2 rendered
 *     ToggleGroupItem (unwrapped)   2 of 2 rendered
 *     RadioGroupItem (wrapped)      2 of 2 rendered
 *     Option (wrapped)              1 of 2 rendered   ← only this one
 *
 * So it is a `ListBox`/`Tabs` collection-builder fact, not a collection fact.
 * `ToggleButtonGroup` and `RadioGroup` tolerate a wrapper perfectly well.
 *
 * The reason therefore has to be carried on the item itself, as `tabs.tsx`
 * does: `data-disabled-reason` for a test and for the screen, and `title` where
 * react-aria has not already eaten it.
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
  );
}
