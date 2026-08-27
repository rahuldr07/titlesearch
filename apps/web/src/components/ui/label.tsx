import { LabelContext, Label as LabelPrimitive, type LabelProps } from "react-aria-components"

import { cx } from "@/components/ui/cx"
import { labelClass } from "@/components/ui/field-chrome"

/**
 * THE FIELD LABEL. RECIPES §Inputs: "Labels: 11px w700 grey above."
 *
 * The registry drew it at `text-sm font-medium` in body ink, which makes the
 * label compete with the value it names. 11px w700 in `--color-ink-faint` puts
 * it a full tier back, and rule 4 keeps it sentence case — the ALL-CAPS
 * spelling is legal only for sidebar rubrics and serif certificate headings.
 *
 * `opacity-50` on a disabled label is deleted in favour of `text-ink-disabled`.
 * At 11px, half-transparent grey on white is below 3:1 and stops being a label
 * at all; the disabled ink tier exists precisely so a control can recede
 * without becoming unreadable.
 *
 * The `LabelContext.Provider value={null}` wrapper is KEPT verbatim from the
 * registry. A `htmlFor` label inside a react-aria field would otherwise be
 * captured by the enclosing field's context and re-pointed at that field's
 * control, silently ignoring the `htmlFor` the caller wrote.
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
