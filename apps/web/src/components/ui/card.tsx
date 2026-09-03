import { createContext, use, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cx } from "./cx";

/**
 * The radius arithmetic lives here (inner = outer − gap): a 10px control
 * inside a 10px card leaves a visible crescent at every corner, so there is
 * no `radius` prop — a caller who could pass one could break the arithmetic.
 *
 * Nested cards throw, via two contexts rather than one boolean. `InsideCard`
 * is never cleared — once inside a card you are inside it at every depth, so
 * card > panel > card still throws. `InsidePanel` is separate and is what
 * `InnerPanel` sets, so card > panel > panel stays legal.
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
      /** Evidence and deliverables render as paper — a scan is a different
          kind of object from a UI surface. */
      paper: "bg-surface-paper font-serif text-page-ink",
    },
    /** A hairline rule, or depth. Never both: depth separates from the canvas,
        hairlines divide the interior. */
    edge: {
      hairline: "border border-line-strong",
      raised: "border border-line-strong shadow-card",
      none: "",
    },
    /** `none` is for a card whose own header and rows carry their padding —
        the header-plus-rows shape. */
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
 * CardHeader carries the spec's ink-faint at 11px bold on `surface-sunken`.
 *
 * This comment used to claim the header deviated to ink-muted because
 * ink-faint measured 3.17:1 there, under AA's 4.5:1 — but card-slots.tsx has
 * always rendered ink-faint, so the deviation was described and never made,
 * and the header was below AA for as long as the note said it wasn't. The
 * token was darkened instead (see tokens.css and apps/web/tokens.contrast.test.ts):
 * ink-faint is 5.09:1 on sunken now, so the spec's own tier is the correct
 * one here and no deviation is needed.
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
