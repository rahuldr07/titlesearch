import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cx } from "./cx";

/**
 * ADAPTED FROM THE REGISTRY `badge`, AND SPLIT IN TWO.
 *
 * The registry ships one `Badge` with six variants (default/secondary/
 * destructive/outline/ghost/link), `dark:` rings, and `text-xs`. Rule 6 says a
 * row carries ONE status signal — a mark (✓ ◆ •) plus weight — and colored
 * capsules appear only at moments of record: released, quarantine clear, T1.
 * A single component with a `variant` prop cannot express that budget, because
 * a variant is a thing a developer flips without deciding.
 *
 *   <StatusMark>  a glyph plus weight. Free. Use in every row.
 *   <Badge>       a tinted capsule. Expensive. A moment of record only.
 *
 * A reviewer seeing `<Badge>` inside a table row can call it a rule 6 violation
 * from the element name alone. `link` and `ghost` are dropped: a badge that is
 * a link is a link, and a badge with no fill is a StatusMark.
 *
 * Tones are the THREE state families the token file ships plus `accent`. No
 * `info`, no `success` — those would be a fourth and fifth hue on a screen that
 * spends colour deliberately.
 */
const capsule = cva(
  [
    // Rule 7: pills are 999px and this is one of the four legal pill uses.
    "inline-flex w-fit shrink-0 items-center gap-3 rounded-pill border px-5 py-1",
    // Rule 4: sentence case. NOT uppercase — ALL-CAPS is legal only in sidebar
    // rubrics and serif certificate headings, and a status capsule is neither.
    // Rule 2: `text-label` (11px), one of the six. The registry's `text-xs`
    // does not exist as a utility in this app.
    "font-sans text-label leading-flat font-semibold whitespace-nowrap",
  ],
  {
    variants: {
      tone: {
        settled: "border-state-settled-border bg-state-settled-surface text-state-settled",
        attend: "border-state-attend-border bg-state-attend-surface text-state-attend",
        halt: "border-state-halt-border bg-state-halt-surface text-state-halt",
        /* Rule 1: a spend of the accent. Once per screen, WITH the primary
           action rather than in addition to it. */
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
 * The glyph vocabulary, and it is closed: ✓ ◆ • T1 (rule 7). A union rather
 * than a string, so a fifth mark is a compile error rather than design drift.
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
 * `aria-hidden`. Colour is never the only carrier — glyph, weight and words all
 * differ — so this survives greyscale and a red-green deficiency, which is what
 * CONTEXT §11 asks of the NA states and is no less true here.
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
