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
export type InputProps = Omit<
  React.ComponentProps<typeof InputPrimitive>,
  "isDisabled" | "disabled"
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
