import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cx } from "./cx";

/**
 * Two deliberately separate shapes:
 *   <StatusMark>  a glyph plus weight. Free. Use in every row.
 *   <Badge>       a tinted capsule. Expensive. A moment of record only.
 * The split keeps the budget visible at the call site — a Badge inside an
 * ordinary table row is wrong on sight.
 */
const capsule = cva(
  [
    "inline-flex w-fit shrink-0 items-center gap-3 rounded-pill border px-5 py-1",
    // Sentence case, never uppercase; text-label is one of the six sizes.
    "font-sans text-label leading-flat font-semibold whitespace-nowrap",
  ],
  {
    variants: {
      tone: {
        settled: "border-state-settled-border bg-state-settled-surface text-state-settled",
        attend: "border-state-attend-border bg-state-attend-surface text-state-attend",
        halt: "border-state-halt-border bg-state-halt-surface text-state-halt",
        // A spend of the accent — once per screen, with the primary action.
        accent: "border-action-border bg-action-surface text-action",
      },
    },
    defaultVariants: { tone: "settled" },
  },
);

export type BadgeProps = VariantProps<typeof capsule> & {
  readonly children: ReactNode;
  readonly className?: string | undefined;
};

/** A moment of record: released, quarantine clear, T1. Never an ordinary row. */
export function Badge({ tone, className, children }: BadgeProps) {
  return (
    <span data-slot="badge" data-tone={tone ?? "settled"} className={cx(capsule({ tone }), className)}>
      {children}
    </span>
  );
}

/**
 * The closed glyph vocabulary: ✓ ◆ • T1. A union rather than a string, so a
 * fifth mark is a compile error rather than design drift.
 */
export type Mark = "settled" | "attend" | "halt" | "tier1";

const GLYPH: Record<Mark, string> = {
  settled: "✓",
  attend: "◆",
  halt: "•",
  tier1: "T1",
};

const MARK_INK: Record<Mark, string> = {
  settled: "text-state-settled",
  attend: "text-state-attend",
  halt: "text-state-halt",
  tier1: "text-state-halt",
};

/**
 * One status signal for a row: mark plus weight, no capsule and no fill.
 * `label` is required and is what a screen reader gets; the glyph is
 * aria-hidden, so colour is never the only carrier.
 */
export function StatusMark({
  mark,
  label,
  resting,
  className,
}: {
  readonly mark: Mark;
  readonly label: string;
  /** A ✓ on a row you are not being asked to act on. Desaturated, not hidden. */
  readonly resting?: boolean | undefined;
  readonly className?: string | undefined;
}) {
  return (
    <span
      data-slot="status-mark"
      data-mark={mark}
      className={cx(
        "inline-flex items-center gap-4 font-sans text-meta leading-close font-semibold",
        resting === true ? "text-ink-secondary" : MARK_INK[mark],
        className,
      )}
    >
      <span aria-hidden className="font-mono">
        {GLYPH[mark]}
      </span>
      {label}
    </span>
  );
}
