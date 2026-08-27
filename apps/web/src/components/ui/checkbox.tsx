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
 * ADAPTED FROM THE REGISTRY `checkbox`. The registry ships one 900-character
 * class string carrying 8 `dark:` variants, `rounded-[4px]`, `border-input`,
 * `ring-ring/50` and a boolean `isDisabled`. Every one of those is replaced.
 *
 *   - `rounded-[4px]` is an arbitrary value the rules gate bans; `rounded-xs`
 *     IS 4px and is the token file's "kbd" rung, the innermost object.
 *   - the focus ring becomes `tp-ring`, keyed to react-aria's own
 *     `data-focus-visible`, so keyboard focus rings and mouse presses do not.
 *   - `data-[disabled]:opacity-50` goes: rule 9 says a disabled control states
 *     its REASON, and 50% opacity states nothing while also failing contrast.
 *     `isDisabled` is Omit-ed from the public props and `disabledBecause`
 *     replaces it (see disabled.ts — rule 9 as a type).
 *   - the checkmark is the glyph `✓` rather than lucide's `CheckIcon`. Rule 7:
 *     the glyph vocabulary is ✓ ◆ • T1, and this is literally the first of them.
 *     It also drops an icon dependency from the most-rendered control in a
 *     table.
 *
 * The after:-inset pseudo-element is KEPT and is the reason `tp-target` is not
 * enough on its own: the box is 16px and WCAG 2.2 §2.5.8 wants 24, and the
 * inset expands the hit area without expanding the drawn square.
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
         * THE LABEL IS A ROW; THE BOX IS THE FIRST CELL.
         *
         * react-aria renders `Checkbox` as a `<label>` wrapping both the
         * control and its text, so box styling put here lands on the whole
         * row. It did: `size-8` clamped the label to 16px wide and `font-mono
         * text-label` set the LABEL TEXT in 11px mono, which rule 3 reserves
         * for data. The words wrapped one letter per line inside the square.
         *
         * So the label owns layout and typography; `checkboxBox` below owns the
         * drawn square. `group/checkbox` stays here because the box reads the
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
                // The mark, not the label. Rule 7's glyph vocabulary.
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
