import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cx } from "./cx";

/**
 * THE RADIUS ARITHMETIC LIVES HERE (rule 5: inner = outer − gap).
 *
 * 14px surfaces, 10px inputs, 6px inside a 10px wrapper. Those three are not
 * independent choices — they are one choice plus subtraction, and the reason
 * the design says so is that a 10px control inside a 10px card leaves a visible
 * crescent of card between the two curves at every corner.
 *
 * A `Card` is therefore the 14px rung, and everything a screen nests inside it
 * uses the 10px rung, and everything nested inside THAT uses 6. There is no
 * fourth rung and no `radius` prop: a caller who could pass one could break the
 * arithmetic, and the arithmetic is the rule.
 */
const surface = cva("", {
  variants: {
    tone: {
      /** The default. Cards, rows, primary panels. */
      panel: "bg-surface-panel",
      /** Wells, table caps, inset tracks. One step down. */
      sunken: "bg-surface-sunken",
      /**
       * Rule 8: evidence and deliverables render AS PAPER. Warm stock and
       * serif, and NOT the same thing as a sunken panel — a scan is a
       * different kind of object from a UI surface, which is precisely what
       * rule 8 refuses to let the design forget.
       */
      paper: "bg-surface-paper font-serif text-page-ink",
    },
    /** A hairline rule, or depth. Never both: depth separates from the canvas,
        hairlines divide the interior. */
    edge: {
      hairline: "border border-line-strong",
      raised: "shadow-card",
      none: "",
    },
    padding: { none: "", tight: "p-8", comfortable: "p-12" },
  },
  defaultVariants: { tone: "panel", edge: "hairline", padding: "comfortable" },
});

export type CardProps = VariantProps<typeof surface> & {
  readonly children: ReactNode;
  readonly className?: string | undefined;
};

/** The 14px rung. */
export function Card({ tone, edge, padding, className, children }: CardProps) {
  return (
    <div className={cx("rounded-lg", surface({ tone, edge, padding }), className)}>
      {children}
    </div>
  );
}

/**
 * The 10px rung: a panel nested inside a Card. Named for its position in the
 * arithmetic rather than for what a screen happens to put in it.
 */
export function InnerPanel({ tone, edge, padding, className, children }: CardProps) {
  return (
    <div className={cx("rounded-md", surface({ tone, edge, padding }), className)}>
      {children}
    </div>
  );
}
