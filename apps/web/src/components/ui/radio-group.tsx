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
 * ADAPTED FROM THE REGISTRY `radio-group`. Same treatment as `checkbox`: the
 * `dark:` register, `border-input`, `ring-ring/50` and the boolean disabled all
 * go, and `disabledBecause` replaces `isDisabled` on both the group and the
 * item (a group-level block — "this order is released, the disposition is
 * fixed" — carries a different sentence from an item-level one, so both slots
 * exist and neither is derived from the other).
 *
 * `rounded-full` → `rounded-pill`. Same 999px, but `rounded-full` is a STATIC
 * Tailwind utility that survives the token file's `--radius-*: initial` reset
 * and is banned for exactly that reason: it is the one radius that could be
 * written without consulting the scale.
 *
 * THE HIT TARGET IS 24px AND SO IS THE ROW, WHICH IS WHY BOTH LINES CHANGED.
 * `after:-inset` is absolute, and the indicator carried no `position`, so it
 * resolved against the ITEM's `relative` instead: a 738x26 rectangle bleeding
 * 6px into the group gap, not the 28x24 around the square the checkbox comment
 * describes. `relative` on the indicator anchors it where it was meant to go.
 * That alone leaves the row short — a 24px target cannot sit inside a 17.55px
 * box (13px at `leading-close`), which is what `scrollHeight 22 > clientHeight
 * 18` was reporting. `tp-target` supplies the floor `checkbox` reasons about
 * but never applied here, so the box and its target are both 24 and coincide.
 *
 * The dot is `bg-ink-on-action` on an accent fill, matching the checkbox, so a
 * selected radio and a checked box read as the same act. Rule 1 is not violated
 * by this: a form's selected control is the same single accent spend as the
 * primary action it sits above, and a screen showing both an accent radio and
 * an accent Confirm has one spend too many — which is a screen-level review
 * question, not something a primitive can enforce.
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
