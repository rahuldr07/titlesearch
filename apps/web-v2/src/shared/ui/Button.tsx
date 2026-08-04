import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "./classNames";

/**
 * The design draws 129 styled buttons. They resolve to two axes — `tone` (what
 * the action MEANS) and `fill` (how loudly it says it) — plus a size ladder.
 * Rules taken from the design and enforced here rather than left to callers:
 *
 * 1. DISABLED IS A SURFACE SWAP, NEVER OPACITY. Every disabled control in the
 *    design swaps to --ground / --ink-muted / --line-strong with
 *    `cursor:not-allowed`. Opacity is reserved for a different meaning —
 *    permission-denied and retired — so using it here would collide with that.
 *    `disabled:` utilities win over the tone classes because they come last.
 * 2. Tone names are SEMANTIC, not colour. `tone="halt"` is "this stops
 *    something", not "this is red" (§6: names describe role).
 * 3. ONE SOLID ACCENT ACTION PER SCREEN — see DEFAULT_FILL.
 * 4. No `loading` variant: the design never draws one (§12).
 */
/* eslint-disable-next-line react-refresh/only-export-components -- exported so the variant logic is testable as a pure function in the node gate; a mutation audit showed component tests alone never caught a collapsed variant set. */
export const buttonClasses = cva(
  [
    "inline-flex items-center justify-center gap-3.5 border font-semibold whitespace-nowrap",
    "transition-none", // the design declares no transitions anywhere
    "disabled:cursor-not-allowed disabled:border-line-strong disabled:shadow-none",
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
        solid: "text-ink-on-action shadow-card",
        outlined: "bg-surface-raised shadow-card",
        tinted: "",
        ghost: "border-transparent bg-transparent",
      },
      size: {
        // The mockup's two densities: 13x7 at 12.5px (`.btn`), 18x10 at 13.5px
        // (`.btn.big`). Both land on the 2px grid exactly.
        sm: "px-5 py-3 text-xs rounded-5",
        md: "px-6.5 py-3.5 text-md rounded-5",
        lg: "px-9 py-5 text-xl rounded-6",
        xl: "w-full px-9 py-6 text-xl rounded-6",
      },
      block: { true: "w-full", false: "" },
    },
    compoundVariants: [
      // solid — the wax IS the screen's one action; ink is the mockup's
      // `.btn.solid` ("Resume →"), a loud press that is NOT the headline.
      // `text-surface-panel` inverts with the theme, so the ink button stays
      // legible when ink-primary is the light value.
      { fill: "solid", tone: "action", class: "border-action bg-action" },
      { fill: "solid", tone: "neutral", class: "border-ink-primary bg-ink-primary text-surface-panel" },
      { fill: "solid", tone: "settled", class: "border-state-settled bg-state-settled" },
      { fill: "solid", tone: "attend", class: "border-state-attend bg-state-attend" },
      { fill: "solid", tone: "halt", class: "border-state-halt bg-state-halt" },

      // outlined — the mockup's `.btn.line`: brightest paper, a hairline in the
      // tone's PALE border value, the tone's deep ink. Deliberately not the
      // saturated base — an outline that shouts colour competes with the one
      // solid accent, which is the discipline this reskin exists to land.
      { fill: "outlined", tone: "action", class: "border-action-border text-action-ink" },
      { fill: "outlined", tone: "settled", class: "border-state-settled-border text-state-settled-ink" },
      { fill: "outlined", tone: "attend", class: "border-state-attend-border text-state-attend-ink" },
      { fill: "outlined", tone: "halt", class: "border-state-halt-border text-state-halt-ink" },
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
type Tone = NonNullable<ButtonVariants["tone"]>;

/**
 * THE ACCENT DISCIPLINE, AS A DEFAULT INSTEAD OF A CONVENTION.
 *
 * RULE: one solid accent action per screen; everything else is a hairline on
 * bright paper; destructive stays solid. FAILURE PREVENTED: as a house style
 * that rule survives about four screens. Here, a call site that states only
 * what the button MEANS gets the design's loudness for free — `settled` and
 * `attend` come out as outlines, and wax is reachable only via `tone="action"`
 * — the screen's action by definition. A second wax button is then a second
 * bare `<Button>`, visible at the call site rather than an invisible style
 * choice. `fill` still overrides, but `fill="solid" tone="settled"` is a
 * sentence saying "yes, two loud buttons" — the review conversation to have.
 *
 * Module-private for the same reason. `buttonClasses` keeps `fill: "solid"` in
 * its own defaults because six call sites style a `<Link>` with only
 * `size`/`tone` — all six `action` or `halt`, where this map agrees.
 */
const DEFAULT_FILL: Record<Tone, NonNullable<ButtonVariants["fill"]>> = {
  action: "solid",
  halt: "solid",
  settled: "outlined",
  attend: "outlined",
  neutral: "outlined",
};

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">,
    ButtonVariants {
  children: ReactNode;
  className?: string;
  /**
   * React 19 passes `ref` as a normal prop — no `forwardRef` needed. Declared
   * because focus must be movable onto a button programmatically:
   * `DestructiveConfirm` moves focus to the confirm step when it arms, without
   * which a keyboard user's focus sits on a button whose label silently changed.
   */
  ref?: Ref<HTMLButtonElement> | undefined;
}

export function Button({
  tone = "action",
  fill,
  size,
  block,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        // `?? "action"` covers the null cva allows, which the default cannot.
        buttonClasses({ tone, fill: fill ?? DEFAULT_FILL[tone ?? "action"], size, block }),
        className,
      )}
      {...rest}
    />
  );
}
