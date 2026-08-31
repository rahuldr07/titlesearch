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
 * The variant table lives in button-chrome.ts because Fast Refresh cannot
 * hot-swap a module that exports both a component and a constant.
 */

type Shared = VariantProps<typeof buttonVariants> &
  Disablement & { readonly className?: string | undefined }

export type ButtonProps = Omit<ButtonPrimitiveProps, "isDisabled" | "className"> &
  React.RefAttributes<HTMLButtonElement> &
  Shared

/**
 * `isDisabled` is omitted, so the only way to disable a button in this app
 * is to say why (disabled.ts).
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
