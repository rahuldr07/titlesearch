import * as React from "react"
import { composeRenderProps, TextArea as TextareaPrimitive } from "react-aria-components"

import { cx } from "@/components/ui/cx"
import { disabledNativeAttributes, type Disablement } from "@/components/ui/disabled"
import { controlClass } from "@/components/ui/field-chrome"

/**
 * The multi-line control, on the same box as Input (field-chrome.ts).
 * `min-h-36` is 72px at the app's 2px base — three lines of 13px plus
 * padding. `field-sizing-content` makes the box grow with the note: a fixed
 * box that scrolls internally hides the end of a sentence someone is about
 * to sign.
 */
export type TextareaProps = Omit<
  React.ComponentProps<typeof TextareaPrimitive>,
  "isDisabled" | "disabled"
> &
  Disablement & {
    /** Mono is for data only. Opt in; nothing infers it. */
    readonly data?: boolean | undefined
  }

function Textarea({ className, data, disabledBecause, ...props }: TextareaProps) {
  return (
    <TextareaPrimitive
      data-slot="textarea"
      {...props}
      {...disabledNativeAttributes(disabledBecause)}
      className={composeRenderProps(className, (resolved) =>
        cx(
          controlClass,
          "flex field-sizing-content min-h-36 py-5",
          data === true && "font-mono",
          resolved
        )
      )}
    />
  )
}

export { Textarea }
