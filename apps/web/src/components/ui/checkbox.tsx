"use client";

import {
  Checkbox as CheckboxPrimitive,
  composeRenderProps,
  type CheckboxProps as CheckboxPrimitiveProps,
} from "react-aria-components";

import { cx } from "./cx";
import { disabledAttributes, type Disablement } from "./disabled";
import { BlockedHint } from "./blockedHint";

/**
 * The drawn square is 16px and WCAG 2.2 §2.5.8 wants 24, so the after:-inset
 * pseudo-element expands the hit area without expanding the square —
 * tp-target alone is not enough here.
 */
export type CheckboxProps = Omit<CheckboxPrimitiveProps, "isDisabled"> & Disablement;

function Checkbox({ className, children, disabledBecause, ...props }: CheckboxProps) {
  return (
    <BlockedHint reason={disabledBecause}>
      <CheckboxPrimitive
        data-slot="checkbox"
        {...props}
        {...disabledAttributes(disabledBecause)}
        /*
         * react-aria renders Checkbox as a <label> wrapping both the control
         * and its text, so box styling put here lands on the whole row. The
         * label owns layout and typography; the indicator span owns the drawn
         * square. `group/checkbox` stays here because the box reads the
         * label's state through it.
         */
        className={cx(
          "tp-ring group/checkbox flex w-fit cursor-pointer items-center gap-4",
          "font-sans text-meta leading-close text-ink-primary",
          "data-disabled:cursor-not-allowed data-disabled:text-ink-disabled",
          className,
        )}
      >
        {composeRenderProps(children, (children, { isSelected, isIndeterminate }) => (
          <>
            <span
              data-slot="checkbox-indicator"
              aria-hidden
              className={cx(
                "tp-state tp-press relative grid size-8 shrink-0 place-content-center",
                "rounded-xs border border-control-border bg-control-fill",
                // WCAG 2.2 §2.5.8: the square is 16px, the hit area is not.
                "after:absolute after:-inset-x-3 after:-inset-y-2",
                // The mark, not the label — mono is reserved for data.
                "font-mono text-label leading-flat",
                "group-hover/checkbox:group-not-data-disabled/checkbox:border-ink-faint",
                "group-data-selected/checkbox:border-action group-data-selected/checkbox:bg-action group-data-selected/checkbox:text-ink-on-action",
                "group-data-indeterminate/checkbox:border-action group-data-indeterminate/checkbox:bg-action group-data-indeterminate/checkbox:text-ink-on-action",
                "group-data-disabled/checkbox:border-line-strong group-data-disabled/checkbox:bg-surface-sunken group-data-disabled/checkbox:text-ink-disabled",
              )}
            >
              {isIndeterminate ? "•" : isSelected ? "✓" : ""}
            </span>
            {children}
          </>
        ))}
      </CheckboxPrimitive>
    </BlockedHint>
  );
}

export { Checkbox };
