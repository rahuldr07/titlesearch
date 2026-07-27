import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./classNames";

/**
 * The small tinted label — 37 uppercase chips plus ~14 mono variants.
 *
 * Every tone is a fixed four-tuple in the design: tint surface, hex border,
 * tone ink for the chip itself, and a deeper ink for body text on that surface.
 * The first three are what a chip needs; they are never mixed across families.
 *
 * `bordered` is a real axis, not an oversight — the export omits the border on
 * neutral, settled and attend chips and keeps it on action and halt. Defaulting
 * it on would quietly restyle three families.
 *
 * This is NOT the component for a no-value state. Those four have their own
 * border-style and fill-pattern language so they survive greyscale, and
 * collapsing them into a tone here is the exact failure CONTEXT §11 forbids.
 */
const chip = cva("inline-flex items-center uppercase whitespace-nowrap", {
  variants: {
    tone: {
      // Every tone uses its `-ink` value on its own tint, NOT its base colour.
      // The design uses the base (e.g. `--amber` on `--amber-tint`) and that
      // measures 4.12:1 — below AA, at 9px, on a chip that carries a state
      // word. `-ink` on the same tint measures 6.82:1. Same correctness fix as
      // --color-ink-muted, and `Button`'s tinted fill already did this.
      action: "text-action-ink bg-action-surface border-action-border",
      settled: "text-state-settled-ink bg-state-settled-surface border-state-settled-border",
      attend: "text-state-attend-ink bg-state-attend-surface border-state-attend-border",
      halt: "text-state-halt-ink bg-state-halt-surface border-state-halt-border",
      neutral: "text-ink-muted bg-surface-app border-line-strong",
      /** solid violet, white text — "yours", the strongest chip in the design */
      inverse: "text-ink-on-action bg-action border-action",
    },
    size: {
      micro: "text-micro tracking-badge font-bold px-3 py-1 gap-2",
      sm: "text-micro tracking-badge font-bold px-4 py-1 gap-3",
      md: "text-micro tracking-label font-bold px-4 py-2 gap-3",
    },
    shape: {
      tag: "rounded-3",
      pill: "rounded-pill",
      /** mono page refs and version badges */
      mono: "rounded-4 font-mono",
    },
    bordered: { true: "border", false: "" },
  },
  defaultVariants: { tone: "neutral", size: "sm", shape: "tag", bordered: false },
});

type ChipVariants = VariantProps<typeof chip>;

export interface ChipProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "className">,
    ChipVariants {
  children: ReactNode;
  className?: string;
}

export function Chip({ tone, size, shape, bordered, className, ...rest }: ChipProps) {
  return (
    <span className={cn(chip({ tone, size, shape, bordered }), className)} {...rest} />
  );
}
