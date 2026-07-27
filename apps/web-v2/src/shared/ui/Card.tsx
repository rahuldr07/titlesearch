import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./classNames";

/**
 * The container. ~35 instances, and the design separates cards with a BORDER,
 * never elevation — `--shadow-card` has no source in the export at all
 * (tokens.md §6.2). Shadow appears only on things that genuinely float: the
 * menu, the drawer, the expanded decision card, and the simulated page.
 *
 * The two greys are not interchangeable, and this is the component that has to
 * get it right: `--color-line-strong` (the design's `--rule`) is the OUTER
 * structural edge; `--color-line-subtle` (`--rule2`) is the INNER separator
 * between header, body and footer. Swapping them makes a card read as a table
 * and a table read as a card.
 */
const card = cva("bg-surface-panel border border-line-strong overflow-hidden", {
  variants: {
    size: {
      /** the standard card (10px) */
      card: "rounded-9",
      /** rulebook detail, new-rule form, screen-failure (12px) */
      emphasis: "rounded-10",
      /** a card nested inside another card (8px) */
      nested: "rounded-7",
    },
    /**
     * The severity edge — a 4px left border. The design uses it for halt and
     * attend banners; settled never takes one, which is deliberate: a settled
     * state is not something you need pulled out of the page.
     */
    accent: {
      none: "",
      action: "border-l-(length:--stroke-severity) border-l-action",
      attend: "border-l-(length:--stroke-severity) border-l-state-attend",
      halt: "border-l-(length:--stroke-severity) border-l-state-halt",
    },
  },
  defaultVariants: { size: "card", accent: "none" },
});

type CardVariants = VariantProps<typeof card>;

export interface CardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "className">,
    CardVariants {
  children: ReactNode;
  className?: string;
}

export function Card({ size, accent, className, ...rest }: CardProps) {
  return <div className={cn(card({ size, accent }), className)} {...rest} />;
}

interface BandProps extends Omit<HTMLAttributes<HTMLDivElement>, "className"> {
  children: ReactNode;
  /** The neutral fill the design uses on header and footer bands. */
  filled?: boolean;
  className?: string;
}

export function CardHeader({ filled = false, className, ...rest }: BandProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-6 px-8 py-6 border-b border-line-subtle",
        filled && "bg-surface-sunken",
        className,
      )}
      {...rest}
    />
  );
}

export function CardFooter({ filled = true, className, ...rest }: BandProps) {
  return (
    <div
      className={cn(
        "px-8 py-5 border-t border-line-subtle text-xs text-ink-muted",
        filled && "bg-surface-sunken",
        className,
      )}
      {...rest}
    />
  );
}

/** Body padding for a card that is a single block rather than banded. */
export function CardBody({ className, ...rest }: BandProps) {
  return <div className={cn("p-8", className)} {...rest} />;
}
