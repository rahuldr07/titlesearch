"use client"

import * as React from "react"
import { composeRenderProps, Input as InputPrimitive } from "react-aria-components"

import { cx } from "@/components/ui/cx"
import { disabledNativeAttributes, type Disablement } from "@/components/ui/disabled"
import { controlClass, controlHeight } from "@/components/ui/field-chrome"

/**
 * Value belongs to the field, not to the box: TextField injects a controlled
 * `value` through InputContext, so a caller's `defaultValue` collides with
 * it, React refuses to have both, and the field silently renders blank.
 * `value` and `defaultValue` are omitted here so the value lives on
 * TextField, which owns it, and a call site that tries is a type error.
 */
export type InputProps = Omit<
  React.ComponentProps<typeof InputPrimitive>,
  "isDisabled" | "disabled" | "value" | "defaultValue"
> &
  Disablement & {
    /**
     * Mono is for data only — order refs, money, citations, hashes,
     * timestamps. A field holding one opts in; nothing infers it.
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
