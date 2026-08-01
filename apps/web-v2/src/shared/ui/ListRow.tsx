import { cva } from "class-variance-authority";
import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "./classNames";

/**
 * The container the row's `first:` exemption is measured against.
 *
 * `:first-child` is a fact about the DOM, not about the data. Let a heading, a
 * filter bar or a conditionally-rendered banner share the parent and the
 * exemption silently moves onto that element instead — the list then opens with
 * a hairline hanging off nothing, and it only appears once the banner's
 * condition happens to be true. Naming the boundary is what stops that: rows,
 * and nothing else, are children of a `DividedSection`.
 */
export interface DividedSectionProps
  extends Omit<HTMLAttributes<HTMLElement>, "className"> {
  /** `ul` for a real list; `div` only where a list element cannot go. */
  as?: "ul" | "div";
  className?: string;
  children: ReactNode;
}

export function DividedSection({ as = "ul", className, ...rest }: DividedSectionProps) {
  const Tag: ElementType = as;
  return <Tag className={cn("flex flex-col", className)} {...rest} />;
}

/**
 * One row of that list — ten sites in the app, three of them
 * (people/PersonRow, products/ProductList, order/StageList) byte-identical.
 *
 * THE HAIRLINE IS `--color-line-subtle`, AND IT SITS ON THE ROW. This is
 * Card.tsx's rule seen from the other side: `line-strong` is the OUTER
 * structural edge, `line-subtle` the INNER separator. Drawn with `line-strong`
 * a list reads as a table that happens to sit inside a card; a card banded with
 * `line-subtle` reads as one row of a table. Neither looks wrong on its own
 * screen. Both look wrong the moment the two are open beside each other, which
 * is well past the point where it is cheap to unpick.
 *
 * `border-t` + `first:border-t-0`, never `border-b` + `last:`. A list opens
 * directly beneath a `CardHeader`, which already draws its own `border-b`. The
 * top-edge spelling lets the first row drop its line and keeps that junction at
 * one hairline; the bottom-edge spelling stacks two and reads as a rule.
 */
const listRow = cva("border-t border-line-subtle first:border-t-0", {
  variants: {
    /**
     * Two measured paddings, not a scale — RE-MEASURED OFF THE MOCKUP in the
     * 2026-08-01 reskin, which is where most of the new look actually lives.
     * `false` is the mockup's queue row, `.orow` at `11px 18px`; `true` is its
     * decision row, `.qrow` at `9px 15px`. The old 16/12 and 12/8 came from the
     * export, and they are the reason the old screens read as taller and
     * narrower than the approved picture: a queue row was 5px shorter in the
     * gutter and 2px taller in the band, which compounds over eight rows into a
     * visibly different page. Ten sites take this, so moving it here moves
     * every screen at once — that is the point, and it is also why a third step
     * is still refused. The in-between values scattered through the tree are
     * one-offs; reproducing them as a variant would ratify a scale nobody drew.
     *
     * ODD NUMBERS ARE WHY `--spacing` IS 2px (index.css): `py-5.5` is 11px and
     * `px-7.5` is 15px with no arbitrary value. On a 4px base neither exists,
     * and the density would have to round — which is how a reskin quietly
     * becomes an approximation of itself.
     */
    dense: { true: "px-7.5 py-4.5", false: "px-9 py-5.5" },
    /**
     * The tint for a row that IS the click target, rather than a row that
     * contains one. `has-[:focus-visible]` repeats the TINT so the row a
     * keyboard lands on is the row that looks live. It deliberately does not
     * repeat the RING: index.css ships exactly one focus treatment for the
     * whole app, and a second drawn here would ring the row around the outline
     * the wrapped button already has.
     */
    interactive: {
      true: "hover:bg-row-hover has-[:focus-visible]:bg-row-hover",
      false: "",
    },
  },
  defaultVariants: { dense: false, interactive: false },
});

/**
 * Attributes are spread rather than enumerated because seven of the ten sites
 * carry a `data-testid` the e2e suite selects on, and a row that cannot be
 * addressed by test is a row the refusal specs cannot assert against.
 */
export interface ListRowProps extends Omit<HTMLAttributes<HTMLElement>, "className"> {
  /** `li` inside a `DividedSection`; `div` only where a list element cannot go. */
  as?: "li" | "div";
  interactive?: boolean;
  dense?: boolean;
  className?: string;
  children: ReactNode;
}

export function ListRow({ as = "li", interactive, dense, className, ...rest }: ListRowProps) {
  const Tag: ElementType = as;
  return <Tag className={cn(listRow({ interactive, dense }), className)} {...rest} />;
}
