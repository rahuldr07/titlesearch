"use client"

import * as React from "react"
import { composeRenderProps, Input as InputPrimitive } from "react-aria-components"

import { cx } from "@/components/ui/cx"
import { disabledNativeAttributes, type Disablement } from "@/components/ui/disabled"
import { controlClass, controlHeight } from "@/components/ui/field-chrome"

/**
 * THE TEXT CONTROL, adapted from the registry's `Input`.
 *
 * Geometry now comes from `field-chrome.ts` (RECIPES §Inputs: 36–38px, radius
 * 10, control fill on control border, 13px) rather than from `h-8 rounded-lg
 * border-input text-base`. Both `dark:` pairs are deleted with the dark
 * register, and `disabled` is no longer a boolean — see `disabled.ts`, which is
 * rule 9 expressed as a type.
 *
 * `cn` became `cx`: stock tailwind-merge has never heard of `text-meta`, reads
 * it as a text COLOUR, and silently drops the real one. See cx.ts.
 */
/**
 * VALUE BELONGS TO THE FIELD, NOT TO THE BOX — and this is a type error rather
 * than a comment because ten call sites already got it wrong.
 *
 * `TextField` injects a CONTROLLED `value` through `InputContext`. A caller's
 * `defaultValue` then collides with it, React refuses to have both, and drops
 * the default. The field renders BLANK. Measured on a three-line probe:
 *
 *     ERR> contains an input of type text with both value and defaultValue
 *     value = ""              ← the defaultValue is gone
 *
 * Every one of those ten stories passed, because a story that asserts "it
 * renders" cannot see an empty box. The damage is worst exactly where the
 * design uses it: RECIPES §Inputs says a read-only field explains itself
 * ("— read from clerk stamp"), and a blank one is a field with no value AND no
 * NA state, which is INVARIANT 8's visible hard error arriving as nothing at
 * all.
 *
 * Omitting both here moves the value to `TextField`, which owns it, and makes
 * the ten existing call sites fail to compile — the only way they get found.
 */
export type InputProps = Omit<
  React.ComponentProps<typeof InputPrimitive>,
  "isDisabled" | "disabled" | "value" | "defaultValue"
> &
  Disablement & {
    /**
     * Rule 3: mono is for DATA ONLY — order refs, money, citations, hashes,
     * timestamps. A field holding one opts IN. Nothing infers it, because a
     * primitive that guessed would be a primitive with domain knowledge.
     */
    readonly data?: boolean | undefined
  }

function Input({ className, type, data, disabledBecause, ...props }: InputProps) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      {...props}
      {...disabledNativeAttributes(disabledBecause)}
      className={composeRenderProps(className, (resolved) =>
        cx(controlClass, controlHeight, data === true && "font-mono", resolved)
      )}
    />
  )
}

export { Input }
