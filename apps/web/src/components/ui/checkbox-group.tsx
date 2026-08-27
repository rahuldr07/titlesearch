"use client";

import {
  CheckboxGroup as CheckboxGroupPrimitive,
  type CheckboxGroupProps as CheckboxGroupPrimitiveProps,
} from "react-aria-components";

import { cx } from "./cx";
import { disabledAttributes, type Disablement } from "./disabled";
import { BlockedHint } from "./blockedHint";

/**
 * SEVERAL CHECKBOXES THAT ARE ONE ANSWER.
 *
 * ADDED to the kit rather than composed at the call site, for two reasons that
 * are both already written down elsewhere in this directory:
 *
 *   - `field-set.tsx` styles `has-[>[data-slot=checkbox-group]]` and
 *     `data-[slot=checkbox-group]:gap-6`. Those selectors were carried over
 *     from the registry with nothing to match them, so the gap they encode was
 *     dead. The name in a stylesheet is a contract; this is the other half.
 *   - Independent `<Checkbox isSelected>` state is a group whose members share
 *     no accessible name and no `role="group"`. A screen reader reads four
 *     unrelated boxes, and there is nowhere to hang the group's `aria-label`.
 *
 * Same treatment as `radio-group`: `isDisabled` is Omit-ed and `disabledBecause`
 * replaces it (rule 9, `disabled.ts`), and `BlockedHint` carries the `title`
 * react-aria's `filterDOMProps` drops off a composite. Both levels of blocking
 * exist and neither is derived from the other — a whole group can be frozen
 * ("the order is released") while one box is barred for its own reason.
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
