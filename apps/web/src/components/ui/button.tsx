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
  ref,
  ...props
}: ButtonProps) {
  const attrs = disabledAttributes(disabledBecause)
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      {...props}
      {...attrs}
      ref={keepTitle(attrs.title, ref)}
      className={cx(buttonVariants({ variant, size, icon }), className)}
    />
  )
}

export type LinkButtonProps = Omit<LinkPrimitiveProps, "isDisabled" | "className"> &
  Shared & { readonly ref?: React.Ref<HTMLAnchorElement> }

/** Navigation that must LOOK like a button. Still an anchor to the browser. */
function LinkButton({
  className,
  variant = "secondary",
  size = "md",
  icon = false,
  disabledBecause,
  ref,
  ...props
}: LinkButtonProps) {
  const attrs = disabledAttributes(disabledBecause)
  return (
    <LinkPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      {...props}
      {...attrs}
      ref={keepTitle(attrs.title, ref)}
      className={cx(buttonVariants({ variant, size, icon }), className)}
    />
  )
}

/**
 * react-aria-components runs its props through `filterDOMProps`, which does
 * not pass `title` — so a disabled control reached the DOM carrying its
 * reason in `data-disabled-reason` (which the specs read) and nothing a
 * person hovering could see. Measured on `release-submit`: reason present,
 * `title` null. This writes it back, and forwards any ref the caller gave.
 */
function keepTitle<T extends HTMLElement>(
  title: string | undefined,
  ref: React.Ref<T> | undefined,
) {
  return (el: T | null) => {
    if (el !== null && title !== undefined) el.setAttribute("title", title)
    if (typeof ref === "function") ref(el)
    else if (ref !== null && ref !== undefined) ref.current = el
  }
}

export { Button, LinkButton }
