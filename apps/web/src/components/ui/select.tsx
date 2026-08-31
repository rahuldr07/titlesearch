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
 * A trigger, a panel and options — a caller who needs search reaches for
 * ComboBox. The chord scope mark is deliberately not set in this file: it
 * rides on Popover, so overlayIsUp() sees it from the moment the panel
 * mounts, one frame before focus reaches the first option. Without it, `q`
 * inside an open Select would both typeahead to "Quarantine" and fire the
 * global chord on the field behind it. `isDisabled` is not in the public
 * props — `disabledBecause` is the only way to turn one off (disabled.ts).
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
           * The placeholder is SelectValue's child, not a prop on the
           * trigger: react-aria renders children only while nothing is
           * selected. Passing it anywhere else makes it a dead prop.
           */}
          <SelectValue className="truncate">
            {({ isPlaceholder, selectedText }) =>
              isPlaceholder ? placeholder : selectedText
            }
          </SelectValue>
          {/* The disclosure arrow is structural affordance — it says the
              control opens — rather than decoration. */}
          <ChevronDownIcon aria-hidden size={16} className="shrink-0 text-ink-muted" />
        </ButtonPrimitive>
        <Popover width="trigger">
          <ListBox className="flex flex-col gap-1 p-2 outline-none">{children}</ListBox>
        </Popover>
      </SelectPrimitive>
    </BlockedHint>
  );
}

export { Option, type OptionProps } from "./option";
