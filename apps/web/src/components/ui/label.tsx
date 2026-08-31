import { LabelContext, Label as LabelPrimitive, type LabelProps } from "react-aria-components"

import { cx } from "@/components/ui/cx"
import { labelClass } from "@/components/ui/field-chrome"

/**
 * The field label: 11px w700 grey above the control. Disabled recedes to
 * text-ink-disabled rather than opacity-50 — at 11px, half-transparent grey
 * on white is below 3:1 and stops being a label.
 *
 * The `LabelContext.Provider value={null}` wrapper is load-bearing: a
 * `htmlFor` label inside a react-aria field would otherwise be captured by
 * the enclosing field's context and re-pointed at that field's control,
 * silently ignoring the `htmlFor` the caller wrote.
 */
function Label({ className, htmlFor, slot, ...props }: LabelProps) {
  const label = (
    <LabelPrimitive
      data-slot="label"
      className={cx(
        labelClass,
        "group-data-[disabled=true]:pointer-events-none",
        "group-data-[disabled=true]:text-ink-disabled",
        "peer-disabled:cursor-not-allowed peer-disabled:text-ink-disabled",
        "peer-data-disabled:text-ink-disabled",
        className
      )}
      {...props}
      htmlFor={htmlFor}
      slot={slot}
    />
  )

  if (htmlFor && slot === undefined) {
    return <LabelContext.Provider value={null}>{label}</LabelContext.Provider>
  }

  return label
}

export { Label }
