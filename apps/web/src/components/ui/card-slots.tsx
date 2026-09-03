import type { ReactNode } from "react";
import { cx } from "./cx";

type SlotProps = { readonly children: ReactNode; readonly className?: string | undefined };

/* The named layout regions of a Card; the nesting contexts stay in card.tsx. */

export function CardHeader({ children, className }: SlotProps) {
  return (
    <div
      data-slot="card-header"
      className={cx(
        "flex items-center justify-between gap-6 border-b border-line-subtle bg-surface-sunken px-12 py-8",
        /* ink-MUTED, not the design's `#8A8E98` (= ink-faint): at 11px that is
           ~3.2:1, below WCAG 1.4.3's 4.5:1, and `field-chrome.ts` had already
           made this exact call for form labels. */
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
