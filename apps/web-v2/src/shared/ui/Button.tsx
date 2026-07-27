import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "./classNames";

/**
 * The design draws 129 styled buttons. They resolve to two axes — `tone` (what
 * the action MEANS) and `fill` (how loudly it says it) — plus a size ladder.
 *
 * Two rules taken from the design and enforced here rather than left to callers:
 *
 * 1. DISABLED IS A SURFACE SWAP, NEVER OPACITY. Every disabled control in the
 *    export swaps to --ground / --ink-muted / --line-strong with
 *    `cursor:not-allowed`. Opacity is reserved for a different meaning —
 *    permission-denied and retired — so using it here would collide with that.
 *    `disabled:` utilities win over the tone classes because they come last.
 *
 * 2. Tone names are SEMANTIC, not colour. `tone="halt"` is "this stops
 *    something", not "this is red" (§6: names describe role).
 *
 * There is no `loading` variant: the design never draws one, and inventing a
 * spinner state would be behaviour sourced only from me (§12).
 */
/* eslint-disable-next-line react-refresh/only-export-components -- exported so the variant logic is testable as a pure function in the node gate; a mutation audit showed component tests alone never caught a collapsed variant set. */
export const buttonClasses = cva(
  [
    "inline-flex items-center justify-center gap-3 font-semibold whitespace-nowrap",
    "transition-none", // the design declares no transitions anywhere
    "disabled:cursor-not-allowed disabled:border-line-strong",
    "disabled:bg-surface-app disabled:text-ink-muted",
  ],
  {
    variants: {
      tone: {
        action: "",
        settled: "",
        attend: "",
        halt: "",
        neutral: "",
      },
      fill: {
        solid: "border-(length:--stroke-emphasis) text-ink-on-action",
        outlined: "border-(length:--stroke-emphasis) bg-surface-panel",
        tinted: "border",
        ghost: "border border-transparent bg-transparent",
      },
      size: {
        // Padding rounds to the 2px grid; the design's odd values (9/11/13px)
        // shift by 1px. Measured and accepted in tokens.md §7.
        sm: "px-5 py-3 text-xs rounded-5",
        md: "px-8 py-5 text-base rounded-6",
        lg: "px-8 py-6 text-md rounded-7",
        xl: "w-full px-8 py-7 text-lg rounded-7",
      },
      block: { true: "w-full", false: "" },
    },
    compoundVariants: [
      // solid — the design uses solid for action, and for the three tones only
      // where the act is itself the outcome (accept / amend / retire)
      { fill: "solid", tone: "action", class: "border-action bg-action" },
      { fill: "solid", tone: "settled", class: "border-state-settled bg-state-settled" },
      { fill: "solid", tone: "attend", class: "border-state-attend bg-state-attend" },
      { fill: "solid", tone: "halt", class: "border-state-halt bg-state-halt" },

      { fill: "outlined", tone: "action", class: "border-action text-action" },
      { fill: "outlined", tone: "settled", class: "border-state-settled text-state-settled" },
      { fill: "outlined", tone: "attend", class: "border-state-attend text-state-attend" },
      { fill: "outlined", tone: "halt", class: "border-state-halt text-state-halt-ink" },
      { fill: "outlined", tone: "neutral", class: "border-line-strong text-ink-secondary" },

      { fill: "tinted", tone: "action", class: "border-action-border bg-action-surface text-action-ink" },
      { fill: "tinted", tone: "settled", class: "border-state-settled-border bg-state-settled-surface text-state-settled-ink" },
      { fill: "tinted", tone: "attend", class: "border-state-attend-border bg-state-attend-surface text-state-attend-ink" },
      { fill: "tinted", tone: "halt", class: "border-state-halt-border bg-state-halt-surface text-state-halt-ink" },

      { fill: "ghost", tone: "neutral", class: "text-ink-primary hover:bg-surface-app" },
      { fill: "ghost", tone: "halt", class: "text-state-halt-ink hover:bg-state-halt-surface" },
    ],
    defaultVariants: { tone: "action", fill: "solid", size: "md", block: false },
  },
);

type ButtonVariants = VariantProps<typeof buttonClasses>;

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">,
    ButtonVariants {
  children: ReactNode;
  className?: string;
  /**
   * React 19 passes `ref` as a normal prop — no `forwardRef` wrapper needed.
   * Declared because focus has to be movable onto a button programmatically:
   * `DestructiveConfirm` moves focus to the confirm step when it arms, without
   * which a keyboard user's focus sits on a button whose label silently changed.
   */
  ref?: Ref<HTMLButtonElement> | undefined;
}

export function Button({ tone, fill, size, block, className, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonClasses({ tone, fill, size, block }), className)}
      {...rest}
    />
  );
}
