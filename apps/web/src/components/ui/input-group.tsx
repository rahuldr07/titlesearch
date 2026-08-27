"use client"

import * as React from "react"
import { Group, type GroupProps } from "react-aria-components"

import { cx } from "@/components/ui/cx"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { controlClass, controlHeight } from "@/components/ui/field-chrome"

/**
 * A CONTROL WITH THINGS ATTACHED — a search box with a magnifier, a money field
 * with a currency, a filter with a clear button.
 *
 * The wrapper now carries the control box (field-chrome.ts) and the inner
 * control drops its own, so the two cannot disagree about a border. Focus and
 * invalid are drawn on the WRAPPER, since the visible box is the wrapper: the
 * registry's `ring-3 ring-ring/50` became the same 2px outline every other
 * control in the kit uses, so a focused input group and a focused input look
 * like the same product.
 *
 * `has-disabled:opacity-50` became the explicit disabled fill. Rule 9's reason
 * lives on the CONTROL inside, which is what the user tabs to.
 */
function InputGroup({ className, ...props }: GroupProps) {
  return (
    <Group
      data-slot="input-group"
      className={cx(
        controlClass,
        controlHeight,
        "group/input-group relative flex items-center gap-3 px-4 py-0",
        "has-[[data-slot=input-group-control]:focus-visible]:border-action",
        "has-[[data-slot=input-group-control]:focus-visible]:outline-2",
        "has-[[data-slot=input-group-control]:focus-visible]:outline-action",
        "has-[[data-slot][aria-invalid=true]]:border-state-halt",
        "has-disabled:bg-surface-sunken has-disabled:border-line-strong",
        "in-data-[slot=combobox-content]:focus-within:border-inherit",
        // A block-aligned addon stacks, so the fixed height has to go.
        "has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col",
        "has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col",
        "has-[>textarea]:h-auto",
        className
      )}
      {...props}
    />
  )
}

/**
 * The wrapper owns the box, so the control gives its own up entirely. The
 * radius steps in to 6px (rule 5: inner = outer − gap) rather than to
 * `rounded-none`, which is a static utility outside the six-radius vocabulary.
 * On a borderless transparent control it is invisible either way; the point is
 * that no class in this kit names a radius the design does not have.
 */
const strippedControl = [
  "flex-1 rounded-sm border-0 bg-transparent px-0 outline-none",
  "focus-visible:outline-none focus-visible:border-0",
  "disabled:bg-transparent disabled:border-0",
]

function InputGroupInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="input-group-control"
      className={cx(strippedControl, className)}
      {...props}
    />
  )
}

function InputGroupTextarea({ className, ...props }: React.ComponentProps<typeof Textarea>) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cx(strippedControl, "resize-none py-4", className)}
      {...props}
    />
  )
}

export { InputGroup, InputGroupInput, InputGroupTextarea }
export { InputGroupAddon, InputGroupButton, InputGroupText } from "./input-group-parts"
