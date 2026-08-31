import {
  composeRenderProps,
  RadioGroup as RadioGroupPrimitive,
  Radio as RadioPrimitive,
  type RadioGroupProps as RadioGroupPrimitiveProps,
  type RadioProps as RadioPrimitiveProps,
} from "react-aria-components";

import { cx } from "./cx";
import { disabledAttributes, type Disablement } from "./disabled";
import { BlockedHint } from "./blockedHint";

/**
 * `disabledBecause` exists on both the group and the item — a group-level
 * block carries a different sentence from an item-level one, and neither is
 * derived from the other.
 *
 * The indicator's `relative` is load-bearing: `after:-inset` is absolute,
 * and without a position on the indicator it resolves against the item's
 * `relative` instead — a full-row rectangle bleeding into the group gap
 * rather than the 24px hit area around the circle. `tp-target` on the item
 * supplies the 24px row floor the 13px text alone cannot.
 */
export type RadioGroupProps = Omit<RadioGroupPrimitiveProps, "isDisabled"> &
  Disablement;

function RadioGroup({ className, disabledBecause, ...props }: RadioGroupProps) {
  return (
    <BlockedHint reason={disabledBecause}>
      <RadioGroupPrimitive
        data-slot="radio-group"
        {...props}
        {...disabledAttributes(disabledBecause)}
        className={cx("grid w-full gap-4", className)}
      />
    </BlockedHint>
  );
}

export type RadioGroupItemProps = Omit<RadioPrimitiveProps, "isDisabled"> & Disablement;

function RadioGroupItem({
  className,
  children,
  disabledBecause,
  ...props
}: RadioGroupItemProps) {
  return (
    <BlockedHint reason={disabledBecause}>
      <RadioPrimitive
        data-slot="radio-group-item"
        {...props}
        {...disabledAttributes(disabledBecause)}
        className={cx(
          "tp-state tp-press tp-ring tp-target group/radio-group-item relative flex cursor-pointer",
          "items-center gap-4 font-sans text-meta leading-close text-ink-primary",
          "data-disabled:cursor-not-allowed data-disabled:text-ink-disabled",
          className,
        )}
      >
        {composeRenderProps(children, (children, { isSelected }) => (
          <>
            <span
              data-slot="radio-group-indicator"
              aria-hidden
              className={cx(
                "tp-state relative flex size-8 shrink-0 items-center justify-center rounded-pill border",
                "after:absolute after:-inset-x-3 after:-inset-y-2",
                isSelected
                  ? "border-action bg-action"
                  : "border-control-border bg-control-fill group-hover/radio-group-item:not-group-data-disabled/radio-group-item:border-ink-faint",
                "group-data-disabled/radio-group-item:border-line-strong group-data-disabled/radio-group-item:bg-surface-sunken",
              )}
            >
              {isSelected && <span className="size-3 rounded-pill bg-ink-on-action" />}
            </span>
            {children}
          </>
        ))}
      </RadioPrimitive>
    </BlockedHint>
  );
}

export { RadioGroup, RadioGroupItem };
