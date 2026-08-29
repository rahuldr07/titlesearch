import type { ReactNode } from "react";
import { cx } from "./cx";

type SlotProps = { readonly children: ReactNode; readonly className?: string | undefined };

/*
 * The two named regions of a Card, split from `card.tsx` on the 150-line gate.
 * The seam is the nesting guard: `card.tsx` holds the two contexts and the
 * surfaces they police, and these are the layout inside one.
 */

export function CardHeader({ children, className }: SlotProps) {
  return (
    <div
      data-slot="card-header"
      className={cx(
        "flex items-center justify-between gap-6 border-b border-line-subtle bg-surface-sunken px-12 py-8",
        "font-sans text-label leading-flat font-bold text-ink-muted",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The body of a header-plus-rows card, carrying the padding the card gave up. */
export function CardBody({ children, className }: SlotProps) {
  return (
    <div data-slot="card-body" className={cx("px-12 py-8", className)}>
      {children}
    </div>
  );
}

/**
 * The 10px rung: a panel nested inside a Card. Named for its position in the
 * arithmetic rather than for what a screen happens to put in it. Clears the
 * nesting flag, so panels may contain panels.
 */
