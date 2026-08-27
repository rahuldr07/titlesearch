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
 * A COMBOBOX IS A SELECT THAT TYPES, AND THE TYPING IS WHY THE CHORD MARK
 * MATTERS TWICE OVER.
 *
 * `focusOwnsKeys` catches this component through TWO different clauses and
 * both are needed:
 *
 *   - the input has `role="combobox"`, which is in `FOCUSED_ITEM_ROLES`, so
 *     every printable key belongs to it while the caret is in it;
 *   - the open panel carries `data-chord-scope="own"` from `Popover`, so
 *     `overlayIsUp()` suspends the vocabulary DOCUMENT-WIDE for the frames
 *     between the panel mounting and focus landing on an option.
 *
 * Neither alone is sufficient. The role clause does nothing while focus is on
 * an `option`; the overlay clause does nothing before the panel opens, and a
 * ComboBox's input is live and swallowing letters the whole time.
 *
 * ══ ADAPTED FROM THE REGISTRY ═══════════════════════════════════════════════
 *
 * The registry shipped FIFTEEN exports, including a full multi-select tag
 * layer (ComboboxChips / ComboboxChipList / ComboboxChip / ComboboxChipsInput)
 * and its own popover anchoring hook. All of it is dropped: this app has no
 * multi-select field in the PRD's data model, and a component kept "in case"
 * is a component nobody has checked against the rules. It can come back with a
 * screen that needs it.
 *
 * Geometry is RECIPES.md §Inputs — 38px, radius 10, `--color-control-fill` on
 * `--color-control-border`, 13px. `bg-popover`/`text-popover-foreground` →
 * `bg-surface-panel`/`text-ink-primary`; every `dark:` variant deleted.
 *
 * Options come from `select.tsx`'s `Option`: one option component, one ✓ mark,
 * one place rule 6's glyph vocabulary is spent. The registry had two nearly
 * identical ones.
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
             * Spread rather than `placeholder={placeholder}`. Under
             * `exactOptionalPropertyTypes`, react-aria's InputProps declares
             * `placeholder?: string` — NOT `string | undefined` — so passing an
             * explicitly-undefined value is a type error rather than an omission.
             * The spread omits the key entirely when there is nothing to say.
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
            /*
             * Rule 7 allows the disclosure arrow as structural affordance. The
             * registry's `ComboboxClear` (an X that wiped the field) is dropped:
             * a destructive-ish control with no label and no reason is exactly
             * what rule 9 exists to prevent, and Esc already reverts the input.
             */
            className="tp-target tp-ring flex cursor-pointer items-center justify-center rounded-xs text-ink-muted outline-none"
          >
            <ChevronDownIcon aria-hidden size={16} />
          </ButtonPrimitive>
        </div>
        <Popover>
          {/*
           * `renderEmptyState` rather than a `ComboboxEmpty` component the caller
           * has to remember to place. An empty filtered list that renders as a
           * zero-height panel is the failure this closes, and react-aria offers
           * the hook precisely so it cannot be forgotten.
           */}
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
