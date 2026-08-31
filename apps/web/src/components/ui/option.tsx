import {
  ListBoxItem,
  type ListBoxItemProps,
} from "react-aria-components";

import { disabledAttributes, type Disablement } from "./disabled";
import { collectionItem, markGutter } from "./overlaySurface";

/**
 * An option. Selection is drawn with a ✓ mark and weight, never colour alone.
 *
 * Deliberately no BlockedHint wrapper: ListBox builds its items through a
 * collection builder that walks the JSX children looking for ListBoxItem,
 * and a wrapper element between the two makes the item silently dropped —
 * not hidden, dropped. (Specific to the ListBox/Tabs builders;
 * ToggleButtonGroup and RadioGroup tolerate a wrapper.) The reason is
 * carried on the item itself: `data-disabled-reason`, plus `title` where
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
       * Required: the mark span makes the children non-plain-text, so
       * react-aria can no longer infer the typeahead string — typing "qu" in
       * an open list would match nothing, while the global chords stand down.
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
