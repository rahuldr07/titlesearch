import { createContext, use, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cx } from "./cx";

/**
 * PORTED AND EXTENDED FROM apps/web-v2's `Surface.tsx` — the Aria registry has
 * no `card`, and this is the design's most-used object.
 *
 * THE RADIUS ARITHMETIC LIVES HERE (rule 5: inner = outer − gap). 14px
 * surfaces, 10px inputs, 6px inside a 10px wrapper. Those are not three
 * independent choices, they are one choice plus subtraction, and the reason the
 * design says so is that a 10px control inside a 10px card leaves a visible
 * crescent of card between the two curves at every corner. There is no `radius`
 * prop: a caller who could pass one could break the arithmetic.
 *
 * ══ NESTED CARDS ARE FORBIDDEN, AND HERE IT IS STRUCTURAL ════════════════════
 *
 * RECIPES §Card states it and no previous kit could enforce it — the old
 * `Surface.tsx` documented `InnerPanel` as the answer and relied on developers
 * choosing it. A context flag makes the violation a runtime throw the first
 * time a story renders it, which is the earliest a nesting mistake can possibly
 * be caught (it is invisible to tsc: `<Card>` deep inside a subtree is still
 * `<Card>`). TWO CONTEXTS, NOT ONE BOOLEAN, and the difference is the whole guard.
 *
 * `InnerPanel` used to clear a single flag going down. That made
 * `Card > InnerPanel > Card` legal — two 14px surfaces, one inside the other,
 * measured and confirmed rendering. So the guard caught the arrangement nobody
 * writes by accident and missed the one that actually happens: a card, a
 * section inside it, and a card in that section.
 *
 * `InsideCard` is now NEVER cleared: once you are within a card you are within
 * it at every depth. `InsidePanel` is separate and is what `InnerPanel` sets,
 * so the legal shape — card > panel > panel — still works, because panels
 * nest by their own rule rather than by pretending the card is gone.
 */
const InsideCard = createContext(false);
const InsidePanel = createContext(false);

const surface = cva("", {
  variants: {
    tone: {
      /** The default. Cards, rows, primary panels. */
      panel: "bg-surface-panel",
      /** Wells, table caps, inset tracks. One step down. */
      sunken: "bg-surface-sunken",
      /** Rule 8: evidence and deliverables render AS PAPER. A scan is a
          different kind of object from a UI surface. */
      paper: "bg-surface-paper font-serif text-page-ink",
    },
    /** A hairline rule, or depth. Never both: depth separates from the canvas,
        hairlines divide the interior. */
    edge: {
      hairline: "border border-line-strong",
      raised: "border border-line-strong shadow-card",
      none: "",
    },
    /** RECIPES: 16–24px padding. `none` is for a card whose own header and rows
        carry their padding — the header-plus-rows shape below. */
    padding: { none: "", tight: "p-8", comfortable: "p-12" },
  },
  defaultVariants: { tone: "panel", edge: "raised", padding: "comfortable" },
});

export type SlotProps = {
  readonly children: ReactNode;
  readonly className?: string | undefined;
};

export type CardProps = VariantProps<typeof surface> & SlotProps;

/** The 14px rung. Never inside another Card — that throws. */
export function Card({ tone, edge, padding, className, children }: CardProps) {
  if (use(InsideCard)) {
    throw new Error(
      "Nested cards are forbidden (RECIPES §Card). Use <InnerPanel> for the 10px rung inside a card.",
    );
  }

  return (
    <InsideCard value={true}>
      <div data-slot="card" className={cx("rounded-lg", surface({ tone, edge, padding }), className)}>
        {children}
      </div>
    </InsideCard>
  );
}

/**
 * The header row from RECIPES: "11px w700 sentence case on control-fill with a
 * line-subtle rule". A slot rather than a `title` prop because the right-hand
 * end routinely carries a SegmentedControl or a count, and a prop taking a
 * ReactNode is a slot with a worse name.
 *
 * ══ ONE DELIBERATE DEVIATION FROM THE SPEC, AND IT IS A CONTRAST FAILURE ═════
 *
 * RECIPES specifies the header ink as `--color-ink-faint`. MEASURED by the
 * story's own axe run: 3.17:1 at 11px bold on `--color-control-fill`, against
 * an AA requirement of 4.5:1. The spec value fails, and it fails on the ONE
 * piece of chrome that labels every card in the product.
 *
 * So this uses `--color-ink-muted` (#6e7480), the next tier up, which the token
 * file measures at 4.63:1 on panel and which clears AA here. The visual
 * intention — a receding label, quieter than its content — survives one tier
 * up; the alternative was shipping a legible-to-some header everywhere.
 *
 * This is a spec defect worth reporting back, not a licence: `ink-faint`
 * remains correct at larger sizes and lighter weights. Flagged for the design
 * handoff rather than silently absorbed.
 */
export { CardHeader, CardBody } from "./card-slots";

export function InnerPanel({ tone, edge, padding, className, children }: CardProps) {
  return (
    <InsidePanel value={true}>
      <div
        data-slot="inner-panel"
        className={cx("rounded-md", surface({ tone, edge: edge ?? "hairline", padding }), className)}
      >
        {children}
      </div>
    </InsidePanel>
  );
}
