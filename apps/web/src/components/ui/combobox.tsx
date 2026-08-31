import type { ReactNode } from "react";
import {
  Button as ButtonPrimitive,
  ComboBox as ComboBoxPrimitive,
  Input as InputPrimitive,
  ListBox,
  type ComboBoxProps as ComboBoxPrimitiveProps,
} from "react-aria-components";
import { ChevronDownIcon } from "lucide-react";

import { cx } from "./cx";
import { disabledAttributes, type Disablement } from "./disabled";
import { BlockedHint } from "./blockedHint";
import { Popover } from "./popover";

/**
 * The chord layer catches this component through two clauses, and both are
 * needed: role="combobox" owns printable keys while the caret is in the
 * input (but does nothing once focus is on an option), and the open panel's
 * data-chord-scope="own" suspends the vocabulary document-wide (but does
 * nothing before the panel opens). Options come from select.tsx's Option —
 * one option component, one ✓ mark.
 */
export type ComboBoxProps = Omit<
  ComboBoxPrimitiveProps<object>,
  "isDisabled" | "className" | "children"
> &
  Disablement & {
    /** The control's accessible name. An unnamed combobox is unusable. */
    readonly label: string;
    /** `Option` elements, or a Collection render over them. */
    readonly children: ReactNode;
    readonly placeholder?: string | undefined;
  };

export function ComboBox({
  label,
  disabledBecause,
  placeholder,
  children,
  ...props
}: ComboBoxProps) {
  return (
    /* `BlockedHint` carries the `title` react-aria's `filterDOMProps` drops
       from a composite — see `blockedHint.tsx`. */
    <BlockedHint reason={disabledBecause}>
      <ComboBoxPrimitive
        {...props}
        {...disabledAttributes(disabledBecause)}
        aria-label={label}
        /*
         * allowsEmptyCollection defaults false, and without it the
         * renderEmptyState below is dead code — the panel that would say
         * "No matches." never mounts.
         */
        allowsEmptyCollection
        data-slot="combobox"
        className="flex flex-col gap-3"
      >
        <div
          className={cx(
            "tp-state flex h-19 w-full items-center gap-2 rounded-md",
            "border border-control-border bg-control-fill pr-2 pl-5",
            "has-data-[focus-visible]:outline has-data-[focus-visible]:outline-action",
          )}
        >
          <InputPrimitive
            data-slot="combobox-input"
            /*
             * Spread rather than `placeholder={placeholder}`: under
             * exactOptionalPropertyTypes, react-aria declares
             * `placeholder?: string`, so an explicitly-undefined value is a
             * type error. The spread omits the key entirely.
             */
            {...(placeholder === undefined ? {} : { placeholder })}
            className={cx(
              "min-w-0 flex-1 bg-transparent font-sans text-meta leading-close",
              "text-ink-primary outline-none placeholder:text-ink-muted",
              "data-disabled:cursor-not-allowed data-disabled:text-ink-disabled",
            )}
          />
          <ButtonPrimitive
            data-slot="combobox-trigger"
            // No clear button: Esc already reverts the input.
            className="tp-target tp-ring flex cursor-pointer items-center justify-center rounded-xs text-ink-muted outline-none"
          >
            <ChevronDownIcon aria-hidden size={16} />
          </ButtonPrimitive>
        </div>
        <Popover width="trigger">
          {/* renderEmptyState rather than a component the caller has to
              remember to place — a forgotten one is a zero-height panel. */}
          <ListBox
            className="flex flex-col gap-1 p-2 outline-none"
            renderEmptyState={() => (
              <div className="px-6 py-5 font-sans text-meta leading-close text-ink-muted">
                No matches.
              </div>
            )}
          >
            {children}
          </ListBox>
        </Popover>
      </ComboBoxPrimitive>
    </BlockedHint>
  );
}

export { Option, type OptionProps } from "./select";
