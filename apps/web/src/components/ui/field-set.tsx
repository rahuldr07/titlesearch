import { cx } from "@/components/ui/cx"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

/**
 * THE OUTER FORM STRUCTURE — set, legend, group, separator.
 *
 * Split out of `field.tsx` to clear the 150-line gate, and the seam is a real
 * one rather than an arbitrary cut: these four are the CONTAINERS a form is
 * built from, while `field.tsx` holds the single field and its parts.
 *
 * Gaps read as `N x 2px` (ui.css sets --spacing to 2px), so the registry's
 * `gap-4` — 16px at the stock base — is restated as `gap-8`. Every spacing
 * token in the registry output halved silently when the base changed, which is
 * a failure that renders rather than errors.
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
 * Rule 2 in one line: a legend is either the SUBJECT of a panel (20px) or a
 * field label (11px w700 grey). The registry's `text-base`/`text-sm` pair had
 * neither, and 16px is the body size — a heading at body size is not a heading.
 *
 * The `label` spelling uses `--color-ink-muted`, not the recipe's `#8A8E98`,
 * for the reason measured in `field-chrome.ts`: ink-faint is 3.27:1 at 11px on
 * white and fails WCAG 1.4.3. Both spellings of an 11px label have to agree,
 * or the one nobody checked is the one that ships.
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
 * The registry's label chip sat on `bg-background`. On this palette a form
 * separator stands on a panel, so it is `bg-surface-panel` — `background` has
 * no counterpart here and guessing `surface-app` would leave a grey notch
 * floating in a white card.
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
 * The label that WRAPS a control (a checkbox row), as opposed to the one that
 * sits above it. Selected state is drawn with the accent's tint pair rather
 * than `primary/5` — an alpha of the accent over an unknown ground is a colour
 * nobody chose, and `--color-action-surface` is the one somebody did.
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
