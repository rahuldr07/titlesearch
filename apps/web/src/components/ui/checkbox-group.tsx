"use client";

import {
  CheckboxGroup as CheckboxGroupPrimitive,
  type CheckboxGroupProps as CheckboxGroupPrimitiveProps,
} from "react-aria-components";

import { cx } from "./cx";
import { disabledAttributes, type Disablement } from "./disabled";
import { BlockedHint } from "./blockedHint";

/**
 * Several checkboxes that are one answer, with one accessible name and
 * role="group". The `data-slot="checkbox-group"` value must stay in sync with
 * the selectors in field-set.tsx. Both levels of blocking exist and neither
 * is derived from the other — a whole group can be frozen while one box is
 * barred for its own reason.
 */
export type CheckboxGroupProps = Omit<CheckboxGroupPrimitiveProps, "isDisabled"> &
  Disablement;

function CheckboxGroup({ className, disabledBecause, ...props }: CheckboxGroupProps) {
  return (
    <BlockedHint reason={disabledBecause}>
      <CheckboxGroupPrimitive
        data-slot="checkbox-group"
        {...props}
        {...disabledAttributes(disabledBecause)}
        className={cx("flex w-full flex-col gap-4", className)}
      />
    </BlockedHint>
  );
}

export { CheckboxGroup };
