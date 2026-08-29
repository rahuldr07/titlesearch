import type { ReactNode } from "react";
import {
  Button as ButtonPrimitive,
  ListBox,
  Select as SelectPrimitive,
  SelectValue,
  type SelectProps as SelectPrimitiveProps,
} from "react-aria-components";
import { ChevronDownIcon } from "lucide-react";

import { cx } from "./cx";
import { disabledAttributes, type Disablement } from "./disabled";
import { BlockedHint } from "./blockedHint";
import { Popover } from "./popover";

/**
 * A SELECT IS A COMPOSITE, WHICH MEANS IT OWNS ITS KEYS WHILE OPEN.
 *
 * The scope mark is NOT set in this file. It rides on `Popover`, which every
 * anchored overlay in the kit portals through, and `overlaySurface.ts` explains
 * why the mark belongs on the panel rather than on the listbox: `overlayIsUp()`
 * must see it from the moment the panel mounts, one frame before focus reaches
 * the first option, and `chords.ts` records that one frame is enough for a held
 * key to repeat. Without it, `q` inside an open Select would both typeahead to
 * "Quarantine" and fire the global escalate chord on the field behind it.
 *
 * ══ ADAPTED FROM THE REGISTRY ═══════════════════════════════════════════════
 *
 * The registry shipped eleven exports — SelectContent, SelectPopover,
 * SelectList, SelectInput (a whole SearchField inside the menu), SelectGroup,
 * SelectLabel, SelectSeparator, SelectEmpty. That is a ComboBox wearing a
 * Select's name, and `combobox.tsx` is where a searchable list lives. This is
 * a trigger, a panel and options: three exports, and a caller who needs search
 * reaches for the component that is named after it.
 *
 * Trigger geometry is RECIPES.md §Inputs: 38px, radius 10, `--color-control-fill`,
 * `--color-control-border`, 13px. `rounded-lg`(8) → `rounded-md`(10 here);
 * `border-input` → `border-control-border`; `text-muted-foreground` →
 * `text-ink-muted`; every `dark:` variant deleted.
 *
 * `isDisabled` is not in the public props. Rule 9 says every disabled control
 * states its reason, so `disabledBecause` is the only way to turn one off —
 * see `disabled.ts`.
 */
export type SelectProps = Omit<
  SelectPrimitiveProps<object>,
  "isDisabled" | "className" | "children"
> &
  Disablement & {
    /** The control's accessible name. An unnamed select is unusable. */
    readonly label: string;
    /** `Option` elements, or a Collection render over them. */
    readonly children: ReactNode;
    readonly placeholder?: string | undefined;
  };

export function Select({
  label,
  disabledBecause,
  placeholder = "Select…",
  children,
  ...props
}: SelectProps) {
  return (
    /* `BlockedHint` carries the `title` react-aria's `filterDOMProps` drops
       from a composite — see `blockedHint.tsx`. */
    <BlockedHint reason={disabledBecause}>
      <SelectPrimitive
        {...props}
        {...disabledAttributes(disabledBecause)}
        aria-label={label}
        data-slot="select"
        className="flex flex-col gap-3"
      >
        <ButtonPrimitive
          data-slot="select-trigger"
          className={cx(
            "tp-state tp-press tp-ring flex h-19 w-full cursor-pointer items-center justify-between",
            "gap-4 rounded-md border border-control-border bg-control-fill px-5 text-left",
            "font-sans text-meta leading-close text-ink-primary outline-none",
            "data-disabled:cursor-not-allowed data-disabled:text-ink-disabled",
          )}
        >
          {/*
           * The placeholder is SelectValue's CHILD, not a prop on the trigger:
           * react-aria renders children only while nothing is selected. Passing
           * it anywhere else makes it a dead prop.
           */}
          <SelectValue className="truncate">
            {({ isPlaceholder, selectedText }) =>
              isPlaceholder ? placeholder : selectedText
            }
          </SelectValue>
          {/*
           * The ONE icon here, and rule 7 ("no icon soup") is why it is allowed:
           * a disclosure arrow is structural affordance — it says the control
           * opens — rather than decoration.
           */}
          <ChevronDownIcon aria-hidden size={16} className="shrink-0 text-ink-muted" />
        </ButtonPrimitive>
        <Popover>
          <ListBox className="flex flex-col gap-1 p-2 outline-none">{children}</ListBox>
        </Popover>
      </SelectPrimitive>
    </BlockedHint>
  );
}

export { Option, type OptionProps } from "./option";
