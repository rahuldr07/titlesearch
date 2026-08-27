import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cx } from "./cx";

/**
 * RULE 6 IS A BUDGET, AND THIS COMPONENT IS WHERE IT IS SPENT.
 *
 * "One status signal per table row — a mark (✓ ◆ •) + weight. Colored capsules
 * only at moments of record (released, quarantine clear, T1)."
 *
 * So there are two shapes here and they are NOT interchangeable:
 *
 *   <StatusMark>  a glyph plus weight. Free. Use in every row.
 *   <Badge>       a tinted capsule. Expensive. A moment of record only.
 *
 * They are separate components rather than a `variant="capsule"` prop for the
 * same reason `Button` has no accent-outline: a variant is a thing a developer
 * flips without deciding, and this is a decision. A reviewer seeing `<Badge>`
 * in a table row can say "that is a rule 6 violation" from the element name
 * alone.
 *
 * The tone names are the THREE state families the token file ships (settled /
 * attend / halt) plus `accent`. There is no `info`, no `neutral-blue`, no
 * `success`: those would be a fourth and fifth hue on a screen that spends
 * colour deliberately.
 */
const capsule = cva(
  [
    "inline-flex items-center gap-3 rounded-pill border px-5 py-1",
    // Rule 4: sentence case. NOT uppercase — ALL-CAPS is legal in exactly two
    // places in this design (sidebar rubrics and serif certificate headings)
    // and a status pill is neither.
    "font-sans text-label leading-flat font-semibold whitespace-nowrap",
  ],
  {
    variants: {
      tone: {
        settled: "border-state-settled-border bg-state-settled-surface text-state-settled",
        attend: "border-state-attend-border bg-state-attend-surface text-state-attend",
        halt: "border-state-halt-border bg-state-halt-surface text-state-halt",
        /** Rule 1: this is a spend of the accent. Once per screen, with the
            primary button, not in addition to it. */
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

/** A moment of record: released, quarantine clear, T1. Not an ordinary row. */
export function Badge({ tone, className, children }: BadgeProps) {
  return <span className={cx(capsule({ tone }), className)}>{children}</span>;
}

/**
 * The glyph vocabulary, and it is closed: ✓ ◆ • T1. Rule 7 lists exactly these
 * four and nothing else, so this is a union rather than a string — a fifth mark
 * is a compile error rather than a design drift.
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
 * ONE status signal for a row: mark plus weight, no capsule and no fill.
 *
 * `label` is required and is what a screen reader gets; the glyph is
 * `aria-hidden`. Colour is never the only carrier — the glyph differs, the
 * weight differs, and the text label is there — so this survives greyscale and
 * a red-green deficiency, which is what CONTEXT §11 asks of the NA states and
 * is no less true here.
 */
export function StatusMark({
  mark,
  label,
  resting,
}: {
  readonly mark: Mark;
  readonly label: string;
  /** A ✓ on a row you are not being asked to act on. Desaturated, not hidden. */
  readonly resting?: boolean | undefined;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-4 font-sans text-meta leading-close font-semibold",
        resting === true ? "text-ink-secondary" : MARK_INK[mark],
      )}
    >
      <span aria-hidden className="font-mono">
        {GLYPH[mark]}
      </span>
      {label}
    </span>
  );
}
