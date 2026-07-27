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
const stamp = cva(
  [
    "inline-block -rotate-6 border-double uppercase font-mono font-semibold",
    "border-(length:--stroke-stamp) leading-flat whitespace-nowrap opacity-90",
  ],
  {
    variants: {
      tone: {
        neutral: "text-ink-primary border-line-strong",
        action: "text-action border-action",
        settled: "text-state-settled border-state-settled",
        attend: "text-state-attend border-state-attend",
        halt: "text-state-halt border-state-halt",
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
