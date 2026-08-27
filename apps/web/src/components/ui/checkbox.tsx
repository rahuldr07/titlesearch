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
        className={cx(
          "tp-state tp-press tp-ring group/checkbox relative flex size-8 shrink-0 cursor-pointer",
          "items-center justify-center rounded-xs border border-control-border bg-control-fill",
          "after:absolute after:-inset-x-3 after:-inset-y-2",
          "font-mono text-label leading-flat",
          "hover:not-data-disabled:border-ink-faint",
          "data-selected:border-action data-selected:bg-action data-selected:text-ink-on-action",
          "data-indeterminate:border-action data-indeterminate:bg-action data-indeterminate:text-ink-on-action",
          "data-disabled:cursor-not-allowed data-disabled:border-line-strong data-disabled:bg-surface-sunken data-disabled:text-ink-disabled",
          className,
        )}
      >
        {composeRenderProps(children, (children, { isSelected, isIndeterminate }) => (
          <>
            <span
              data-slot="checkbox-indicator"
              aria-hidden
              className="grid place-content-center"
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
