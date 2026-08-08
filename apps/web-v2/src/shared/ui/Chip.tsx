import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./classNames";

/**
 * The small tinted label — 37 uppercase chips plus ~14 mono variants.
 *
 * Every tone is a fixed four-tuple: tint surface, hairline, tone ink for the
 * chip itself, and a deeper ink for body text on that surface. The first three
 * are what a chip needs; they are never mixed across families.
 *
 * RULE: THE OUTLINE IS AN INSET RING, NOT A BORDER. The mockup draws every chip
 * edge as `inset 0 0 0 1px` — `.chip.plain`, `.state-chip.red`, `.cite`,
 * `.pchip`, all of them. FAILURE PREVENTED: a border is 2px of extra box, so an
 * outlined chip and a bare one in the same row sit at different heights and
 * push their neighbours apart. Toggling `bordered` must change what you SEE,
 * never what the row measures.
 *
 * `bordered` stays a real axis and stays OFF by default. It is not an
 * oversight and not a candidate for "outline everything": it is half of the
 * accent/halt greyscale mechanism (tokens.css §3) — halt is a firmly outlined
 * object, action an unoutlined tint. Defaulting it on erases that.
 *
 * This is NOT the component for a no-value state. Those have their own
 * border-style and fill-pattern language so they survive greyscale, and
 * collapsing them into a tone here is the exact failure CONTEXT §11 forbids.
 */
const chip = cva("inline-flex items-center uppercase whitespace-nowrap", {
  variants: {
    tone: {
      // Every tone uses its `-ink` value on its own tint, NOT its base colour.
      // The design uses the base (e.g. `--amber` on `--amber-tint`) and that
      // measures 4.12:1 — below AA, at 9.5px, on a chip that carries a state
      // word. `-ink` on the same tint measures 6.82:1. Same correctness fix as
      // --color-ink-muted, and `Button`'s tinted fill already did this.
      action: "text-action-ink bg-action-surface inset-ring-action-border",
      settled:
        "text-state-settled-ink bg-state-settled-surface inset-ring-state-settled-border",
      attend:
        "text-state-attend-ink bg-state-attend-surface inset-ring-state-attend-border",
      halt: "text-state-halt-ink bg-state-halt-surface inset-ring-state-halt-border",
      neutral: "text-ink-secondary bg-surface-sunken inset-ring-line-strong",
      /** solid wax, warm-white text — "yours", the strongest chip in the design */
      inverse: "text-ink-on-action bg-action inset-ring-action",
    },
    /*
     * The mockup runs ONE chip metric — 9.5px/1, 600, .12em, 4px 8px — and
     * these three sizes are that metric plus the two half-steps the app's
     * denser rows need. Weight moved 700 → 600 and the vertical padding 2px →
     * 4px: the old chip was a squashed bold pill, the new one is the mockup's.
     */
    size: {
      micro: "text-micro tracking-badge font-semibold px-3.5 py-2 gap-2.5",
      sm: "text-micro tracking-badge font-semibold px-4 py-2 gap-2.5",
      md: "text-micro tracking-label font-semibold px-5 py-2.5 gap-2.5",
    },
    shape: {
      /** `--radius-2`, the mockup's `--r-chip` */
      tag: "rounded-2",
      pill: "rounded-pill",
      /** mono page refs and version badges — the mockup's `.cite`, `--radius-3` */
      mono: "rounded-3 font-mono",
    },
    bordered: { true: "inset-ring", false: "" },
  },
  defaultVariants: { tone: "neutral", size: "sm", shape: "tag", bordered: false },
});

type ChipVariants = VariantProps<typeof chip>;

export interface ChipProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "className">, ChipVariants {
  children: ReactNode;
  className?: string;
}

export function Chip({ tone, size, shape, bordered, className, ...rest }: ChipProps) {
  return (
    <span className={cn(chip({ tone, size, shape, bordered }), className)} {...rest} />
  );
}
