"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cx } from "@/components/ui/cx"
import { Button } from "@/components/ui/button"

/**
 * THE CHROME THAT ATTACHES TO A CONTROL — addon, inner button, inner text.
 *
 * Split from `input-group.tsx` to clear the 150-line gate, and the seam is a
 * real one: that file owns the BOX and the controls inside it, this one owns
 * the ornaments hung on the box. Both are re-exported from `input-group.tsx`,
 * so a screen still imports one module.
 */
const inputGroupAddonVariants = cva(
  [
    "flex h-auto cursor-text items-center justify-center gap-3 select-none",
    "font-sans text-meta leading-close font-medium text-ink-muted",
    "group-data-[disabled=true]/input-group:text-ink-disabled",
    "[&>kbd]:rounded-xs",
  ],
  {
    variants: {
      align: {
        "inline-start": "order-first",
        "inline-end": "order-last",
        "block-start": "order-first w-full justify-start px-3 pt-4",
        "block-end": "order-last w-full justify-start px-3 pb-4",
      },
    },
    defaultVariants: { align: "inline-start" },
  }
)

/**
 * Clicking the chrome focuses the control, because the chrome LOOKS like part
 * of the control — `cursor-text` promises that and this delivers it. A click
 * that landed on a button inside the addon is that button's, not the input's.
 */
function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cx(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return
        e.currentTarget.parentElement?.querySelector("input")?.focus()
      }}
      {...props}
    />
  )
}

/**
 * A button living INSIDE a control. Ghost and small by default, one step down
 * in radius — rule 5: inner = outer − gap, so 6px inside the 10px wrapper.
 * The registry's four bespoke sizes (`xs`, `icon-xs`, `icon-sm`) collapse into
 * the kit's own `size` + `icon` pair; a control does not get a private scale.
 */
function InputGroupButton({
  className,
  variant = "ghost",
  size = "sm",
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="input-group-button"
      variant={variant}
      size={size}
      className={cx("h-13 min-h-13 gap-3 rounded-sm px-4", className)}
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="input-group-text"
      className={cx(
        "flex items-center gap-3 font-sans text-meta leading-close text-ink-muted",
        "[&_svg]:pointer-events-none",
        className
      )}
      {...props}
    />
  )
}

export { InputGroupAddon, InputGroupButton, InputGroupText }
