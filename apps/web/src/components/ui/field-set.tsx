import { cx } from "@/components/ui/cx"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

/**
 * The outer form structure — set, legend, group, separator. field.tsx holds
 * the single field and its parts. Gaps read as N × 2px: ui.css sets
 * --spacing to 2px, so stock Tailwind spacing halves silently here.
 */
function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cx(
        "flex flex-col gap-8 border-0 m-0 p-0",
        "has-[>[data-slot=checkbox-group]]:gap-6 has-[>[data-slot=radio-group]]:gap-6",
        className
      )}
      {...props}
    />
  )
}

/**
 * A legend is either the subject of a panel (20px) or a field label (11px
 * w700 grey). The `label` spelling uses ink-muted, not ink-faint, for the
 * contrast reason stated in field-chrome.ts — both spellings of an 11px
 * label have to agree.
 */
function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cx(
        "mb-3 font-sans leading-close",
        "data-[variant=legend]:text-subject data-[variant=legend]:font-semibold",
        "data-[variant=legend]:text-ink-primary",
        "data-[variant=label]:text-label data-[variant=label]:font-bold",
        "data-[variant=label]:text-ink-muted",
        className
      )}
      {...props}
    />
  )
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cx(
        "group/field-group @container/field-group flex w-full flex-col gap-10",
        "data-[slot=checkbox-group]:gap-6 *:data-[slot=field-group]:gap-8",
        className
      )}
      {...props}
    />
  )
}

/**
 * The label chip is bg-surface-panel: a form separator stands on a panel,
 * and surface-app would leave a grey notch floating in a white card.
 */
function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children}
      className={cx("relative -my-4 h-10 font-sans text-meta", className)}
      {...props}
    >
      <Separator className="absolute inset-0 top-1/2" />
      {children && (
        <span
          className="relative mx-auto block w-fit bg-surface-panel px-4 text-ink-muted"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  )
}

/**
 * The label that wraps a control (a checkbox row), as opposed to the one
 * that sits above it. Selected state uses the accent's tint pair — an alpha
 * of the accent over an unknown ground is a colour nobody chose.
 */
function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cx(
        "group/field-label peer/field-label flex w-fit gap-4 leading-close",
        "group-data-[disabled=true]/field:text-ink-disabled",
        "has-data-checked:border-action-border has-data-checked:bg-action-surface",
        "has-data-selected:border-action-border has-data-selected:bg-action-surface",
        "has-[>[data-slot=field]]:rounded-md has-[>[data-slot=field]]:border",
        "has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-surface-sunken",
        "has-[>[data-slot=field]]:has-[:focus-visible]:border-action",
        "*:data-[slot=field]:p-5",
        "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col",
        className
      )}
      {...props}
    />
  )
}

export { FieldSet, FieldLegend, FieldGroup, FieldSeparator, FieldLabel }
