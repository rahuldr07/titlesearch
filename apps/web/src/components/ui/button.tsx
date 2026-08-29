import type * as React from "react"
import { type VariantProps } from "class-variance-authority"
import {
  Button as ButtonPrimitive,
  Link as LinkPrimitive,
  type ButtonProps as ButtonPrimitiveProps,
  type LinkProps as LinkPrimitiveProps,
} from "react-aria-components"

import { cx } from "@/components/ui/cx"
import { buttonVariants } from "@/components/ui/button-chrome"
import { disabledAttributes, type Disablement } from "@/components/ui/disabled"

/**
 * THE BUTTON. Four variants, 38px tall, radius 14 — see `button-chrome.ts`,
 * which holds the variant table and the record of what the registry output
 * looked like before it was adapted. The split is Fast Refresh's requirement
 * (a module exporting both a component and a constant cannot be hot-swapped)
 * and this is the file most likely to be edited with the app running.
 */

type Shared = VariantProps<typeof buttonVariants> &
  Disablement & { readonly className?: string | undefined }

export type ButtonProps = Omit<ButtonPrimitiveProps, "isDisabled" | "className"> &
  React.RefAttributes<HTMLButtonElement> &
  Shared

/**
 * `isDisabled` is Omit-ed, so the only way to disable a button in this app is
 * to say why (disabled.ts). That omission IS the enforcement of rule 9.
 */
function Button({
  className,
  variant = "secondary",
  size = "md",
  icon = false,
  disabledBecause,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      {...props}
      {...disabledAttributes(disabledBecause)}
      className={cx(buttonVariants({ variant, size, icon }), className)}
    />
  )
}

export type LinkButtonProps = Omit<LinkPrimitiveProps, "isDisabled" | "className"> & Shared

/** Navigation that must LOOK like a button. Still an anchor to the browser. */
function LinkButton({
  className,
  variant = "secondary",
  size = "md",
  icon = false,
  disabledBecause,
  ...props
}: LinkButtonProps) {
  return (
    <LinkPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      {...props}
      {...disabledAttributes(disabledBecause)}
      className={cx(buttonVariants({ variant, size, icon }), className)}
    />
  )
}

export { Button, LinkButton }
export { buttonVariants } from "./button-chrome"
