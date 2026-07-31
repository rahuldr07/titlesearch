import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./classNames";

/**
 * The rubber stamp — rotated, double-bordered, mono caps. Four instances in the
 * design and the most distinctive thing in it, so it is reproduced exactly
 * rather than approximated.
 *
 * This is a DISPLAY component with no logic. Its label and tone come from the
 * server: `design-classification.md` C2 records the export computing the stamp
 * from a five-branch `if/else` in the browser, which is a client-side state
 * machine and forbidden by hard constraint 9. The component therefore takes a
 * label and a tone and asks no questions about them.
 *
 * `-rotate-6` and the double border are load-bearing to the metaphor; a flat
 * rectangle here reads as a chip and loses the "this was stamped by someone"
 * signal entirely.
 */
/**
 * TWO CONCENTRIC LINES, NOT ONE. The export draws `border:3px double` PLUS an
 * inset ring (`box-shadow:0 0 0 1.5px currentColor inset`), and both halves were
 * missing on screen: `--stroke-stamp` was 2.5px, below the 3px `border-style:
 * double` needs to paint its three parts, so every browser fell back to a solid
 * line and the ring was never spelled at all. The result read as a chip with a
 * thick edge. `opacity-90` is gone with them — the export stamps at full
 * strength, and dimming an ink colour to soften it is the one thing the tone
 * tokens exist to make unnecessary.
 */
const stamp = cva(
  [
    "inline-block -rotate-6 border-double uppercase font-mono font-semibold",
    "border-(length:--stroke-stamp) leading-flat whitespace-nowrap",
    "inset-ring-(length:--stroke-emphasis) inset-ring-current",
  ],
  {
    variants: {
      tone: {
        neutral: "text-ink-primary border-line-strong",
        /*
         * THE INK IS THE `-ink` VALUE; THE BORDER IS THE BASE COLOUR.
         *
         * A stamp's word is small mono text and sits on the app ground as often
         * as on a panel, where the base state colours do not clear AA:
         * `state-attend` measures 4.35:1 on `surface-app` against the 4.5 a
         * reader is owed. `Eyebrow` documented this tier and its reason already
         * — this component simply had not adopted it, and nothing caught that
         * because Tailwind was never compiled for the Storybook a11y run, so
         * axe had been scanning unstyled markup.
         *
         * The BORDER keeps the base colour deliberately: a 2px rule is not text
         * and is held to 3:1, and the double border is the mark that makes a
         * stamp read as a stamp.
         */
        action: "text-action-ink border-action",
        settled: "text-state-settled-ink border-state-settled",
        attend: "text-state-attend-ink border-state-attend",
        halt: "text-state-halt-ink border-state-halt",
      },
      size: {
        /** the header stamp (12px) */
        sm: "text-sm tracking-eyebrow rounded-4 px-6 py-3",
        /** "Session ended" (14px) */
        md: "text-lg tracking-stamp rounded-4 px-8 py-4",
        /** "Reissued · v2" (18px) */
        lg: "text-2xl tracking-stamp rounded-5 px-10 py-5",
        /** "Finalized" — the terminal stamp (20px) */
        xl: "text-3xl tracking-stamp rounded-5 px-11 py-6",
      },
    },
    defaultVariants: { tone: "neutral", size: "sm" },
  },
);

type StampVariants = VariantProps<typeof stamp>;

export interface StampProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "className">,
    StampVariants {
  /** Server-supplied. Never computed from other state. */
  children: ReactNode;
  className?: string;
}

export function Stamp({ tone, size, className, ...rest }: StampProps) {
  return <span className={cn(stamp({ tone, size }), className)} {...rest} />;
}
