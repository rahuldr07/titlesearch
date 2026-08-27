import type { ReactNode } from "react";
import {
  Checkbox as AriaCheckbox,
  CheckboxGroup as AriaCheckboxGroup,
  Text,
  type CheckboxProps as AriaCheckboxProps,
  type CheckboxGroupProps as AriaCheckboxGroupProps,
} from "react-aria-components";
import { cx } from "./cx";
import { disabledAttributes, type Disablement } from "./disabled";

/**
 * A CHECKBOX WHOSE MARK IS A GLYPH, NOT AN ICON.
 *
 * Rule 7 sets the glyph vocabulary at ✓ ◆ • T1, and a checked box is a ✓. Using
 * lucide's `Check` here would be the first drop of icon soup, and it would also
 * put the mark on a different baseline from the ✓ in `Option`, in `Badge` and in
 * the table's status column — four ticks, four shapes.
 *
 * The BOX is 16px because that is what reads correctly beside 16px body text;
 * the TARGET is 24px because WCAG 2.2 §2.5.8 says so. Those are different
 * numbers and both are honoured: `tp-target` sits on the label, which is the
 * hit area, while the drawn box stays 16.
 *
 * `indeterminate` is react-aria's `isIndeterminate`, renamed to a ◆ — "some,
 * not all" is a distinct statement rather than a half-tick.
 */
export type CheckboxProps = Omit<AriaCheckboxProps, "isDisabled" | "className" | "children"> &
  Disablement & { readonly children: ReactNode };

export function Checkbox({ disabledBecause, children, ...props }: CheckboxProps) {
  return (
    <AriaCheckbox
      data-chord-scope="widget"
      {...props}
      {...disabledAttributes(disabledBecause)}
      className={cx(
        "tp-target tp-ring group flex cursor-pointer items-center gap-5 rounded-sm py-2",
        "font-sans text-body leading-close text-ink-primary",
        "data-disabled:cursor-not-allowed data-disabled:text-ink-disabled",
      )}
    >
      {({ isSelected, isIndeterminate }) => (
        <>
          <span
            aria-hidden
            className={cx(
              // Rule 5: 6px inner radius, one step in from the 10px control.
              "tp-state tp-press flex size-8 shrink-0 items-center justify-center rounded-sm border",
              "text-label leading-flat",
              isSelected || isIndeterminate
                ? "border-action bg-action text-ink-on-action"
                : "border-control-border bg-control-fill",
              "group-data-disabled:border-ink-disabled group-data-disabled:bg-surface-sunken group-data-disabled:text-ink-disabled",
            )}
          >
            {isIndeterminate ? "◆" : isSelected ? "✓" : ""}
          </span>
          {children}
        </>
      )}
    </AriaCheckbox>
  );
}

export type CheckboxGroupProps = Omit<
  AriaCheckboxGroupProps,
  "isDisabled" | "className" | "children"
> &
  Disablement & {
    readonly label: string;
    readonly children: ReactNode;
  };

/** A set of related checkboxes with one group label and one reason. */
export function CheckboxGroup({
  label,
  disabledBecause,
  children,
  ...props
}: CheckboxGroupProps) {
  return (
    <AriaCheckboxGroup
      {...props}
      {...disabledAttributes(disabledBecause)}
      className="flex flex-col gap-4"
      aria-label={label}
    >
      <span className="font-sans text-meta leading-close font-medium text-ink-secondary">
        {label}
      </span>
      {children}
      {typeof disabledBecause === "string" && disabledBecause.length > 0 && (
        <Text slot="description" className="font-sans text-meta leading-close text-ink-secondary">
          {disabledBecause}
        </Text>
      )}
    </AriaCheckboxGroup>
  );
}
