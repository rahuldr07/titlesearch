import * as React from "react"
import { composeRenderProps, TextArea as TextareaPrimitive } from "react-aria-components"

import { cx } from "@/components/ui/cx"
import { disabledAttributes, type Disablement } from "@/components/ui/disabled"
import { controlClass } from "@/components/ui/field-chrome"

/**
 * THE MULTI-LINE CONTROL, on the same box as `Input` (field-chrome.ts).
 *
 * `min-h-16` in the registry meant 64px at Tailwind's stock 4px base; at this
 * app's 2px base (ui.css) the same token is 32px, which is under one line. So
 * the floor is restated as `min-h-36` — 72px, three lines of 13px at
 * leading-close plus padding — rather than left to a token whose meaning
 * changed underneath it. That silent halving is exactly the failure the token
 * file warns about for line-height.
 *
 * `field-sizing-content` is KEPT: an examiner's note grows with the note, and
 * a fixed box that scrolls internally hides the end of a sentence someone is
 * about to sign.
 *
 * Both `dark:` pairs deleted; `disabled` is a reason, not a boolean.
 */
export type TextareaProps = Omit<
  React.ComponentProps<typeof TextareaPrimitive>,
  "isDisabled" | "disabled"
> &
  Disablement & {
    /** Rule 3: mono is for data only. Opt in; nothing infers it. */
    readonly data?: boolean | undefined
  }

function Textarea({ className, data, disabledBecause, ...props }: TextareaProps) {
  return (
    <TextareaPrimitive
      data-slot="textarea"
      {...props}
      {...disabledAttributes(disabledBecause)}
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
