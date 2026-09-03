"use client"

import * as React from "react"
import { Group, type GroupProps } from "react-aria-components"

import { cx } from "@/components/ui/cx"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { controlClass, controlHeight } from "@/components/ui/field-chrome"

/**
 * A control with things attached — a search box with a magnifier, a money
 * field with a currency, a filter with a clear button. The wrapper carries
 * the control box (field-chrome.ts) and the inner control drops its own, so
 * the two cannot disagree about a border; focus and invalid are drawn on the
 * wrapper, since the visible box is the wrapper. The disabled reason lives
 * on the control inside, which is what the user tabs to.
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
 * radius steps in to 6px (inner = outer − gap) rather than to rounded-none —
 * no class in this kit names a radius the design does not have.
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
