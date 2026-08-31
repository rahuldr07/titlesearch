import { useMemo } from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cx } from "@/components/ui/cx"
import { descriptionClass, errorClass } from "@/components/ui/field-chrome"

/**
 * A single field and its parts; the containers live in field-set.tsx and are
 * re-exported from here so a screen still imports one module. Invalid
 * colours only the message and the control border — tinting the whole field
 * red turns a wrong postcode into a screen that looks broken.
 */
const fieldVariants = cva(
  "group/field flex w-full gap-4 data-[invalid=true]:text-state-halt",
  {
    variants: {
      orientation: {
        vertical: "flex-col *:w-full [&>.sr-only]:w-auto",
        horizontal: [
          "flex-row items-center",
          "has-[>[data-slot=field-content]]:items-start",
          "*:data-[slot=field-label]:flex-auto",
        ],
        responsive: [
          "flex-col *:w-full [&>.sr-only]:w-auto",
          "@md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto",
          "@md/field-group:has-[>[data-slot=field-content]]:items-start",
          "@md/field-group:*:data-[slot=field-label]:flex-auto",
        ],
      },
    },
    defaultVariants: { orientation: "vertical" },
  }
)

function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cx(fieldVariants({ orientation }), className)}
      {...props}
    />
  )
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cx("group/field-content flex flex-1 flex-col gap-1 leading-close", className)}
      {...props}
    />
  )
}

/**
 * The name of a field drawn as text rather than as a <label> — a read-only
 * row, or a row whose control labels itself. 13px, one tier above the 11px
 * form label, because this one sits beside its value rather than above it.
 */
function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-title"
      className={cx(
        "flex w-fit items-center gap-4 font-sans text-meta leading-close font-semibold",
        "text-ink-primary group-data-[disabled=true]/field:text-ink-disabled",
        className
      )}
      {...props}
    />
  )
}

/**
 * Standing help, and the inline home for a disabled control's reason — a
 * tooltip is unreachable on touch and by most screen readers (disabled.ts).
 */
function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cx(
        descriptionClass,
        "text-left group-has-data-horizontal/field:text-balance",
        "[[data-variant=legend]+&]:-mt-3 last:mt-0 nth-last-2:-mt-2",
        "[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-action",
        className
      )}
      {...props}
    />
  )
}

/**
 * The server's message — the client never authors refusal wording
 * (shared/notify.ts). role="alert" stays: a message that appears after
 * submit and is never announced is one a screen-reader user does not receive.
 */
function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>
}) {
  const content = useMemo(() => {
    if (children) return children
    if (!errors?.length) return null

    const uniqueErrors = [...new Map(errors.map((e) => [e?.message, e])).values()]
    if (uniqueErrors.length === 1) return uniqueErrors[0]?.message

    return (
      <ul className="ml-8 flex list-disc flex-col gap-2">
        {uniqueErrors.map((error, index) => error?.message && <li key={index}>{error.message}</li>)}
      </ul>
    )
  }, [children, errors])

  if (!content) return null

  return (
    <div role="alert" data-slot="field-error" className={cx(errorClass, className)} {...props}>
      {content}
    </div>
  )
}

export { Field, FieldContent, FieldTitle, FieldDescription, FieldError }
export { FieldSet, FieldLegend, FieldGroup, FieldSeparator, FieldLabel } from "./field-set"
