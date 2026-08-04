import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./classNames";

/**
 * A CARD'S INTERIOR STRUCTURE — the three bands, split from the container that
 * holds them.
 *
 * `Card` decides how a block sits on the page: its ground, its edge, its
 * elevation, whether it is provisional. These decide how content is divided
 * INSIDE one, and the two questions are answered by different people at
 * different times. Splitting them also isolates the one rule below, which is
 * easy to lose in a file mostly about shadows.
 *
 * THE INTERIOR HAIRLINE IS THE ONLY 1px RULE LEFT ON A CARD. `Card`'s own doc
 * states the reversal — depth separates, hairlines divide — and this is the
 * "divide" half: header from body from footer, in `--color-line-subtle` and
 * never in `--color-line-strong`, which is darker than the ground and fences
 * the card into a boxed table cell.
 */
interface BandProps extends Omit<HTMLAttributes<HTMLDivElement>, "className"> {
  children: ReactNode;
  /** The neutral fill the design uses on header and footer bands. */
  filled?: boolean;
  className?: string;
}

/** The INTERIOR hairline — the one place a 1px rule still belongs on a card. */
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
