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
     * Two measured paddings, not a scale. 16/12px is the card row — people,
     * products, stages. 12/8px is the row that is itself a button in a narrow
     * column (the escalation cluster rail, the review field list), where the
     * card step spends a fifth of the column on gutter. The in-between values
     * scattered through the tree are one-offs; reproducing them as a third
     * variant would ratify a scale nobody designed.
     */
    dense: { true: "px-6 py-4", false: "px-8 py-6" },
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
