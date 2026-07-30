import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./classNames";

/**
 * The container. ~35 instances, and the design separates cards with a BORDER,
 * never elevation — `--shadow-card` has no source in the export at all
 * (tokens.md §6.2). Shadow appears only on things that genuinely float: the
 * menu, the drawer, the expanded decision card, and the simulated page.
 *
 * The two greys are not interchangeable, and this is the component that has to
 * get it right: `--color-line-strong` (the design's `--rule`) is the OUTER
 * structural edge; `--color-line-subtle` (`--rule2`) is the INNER separator
 * between header, body and footer. Swapping them makes a card read as a table
 * and a table read as a card.
 *
 * Ground and hairline live on ONE axis (`tone`) rather than two props, because
 * the failure being prevented is a mismatched pair, and a component that lets
 * you pass them separately cannot prevent it.
 */
/* eslint-disable-next-line react-refresh/only-export-components -- exported so the variant logic is testable as a pure function in the node gate; a mutation audit showed component tests alone never caught a collapsed variant set. */
export const cardClasses = cva("border overflow-hidden", {
  variants: {
    size: {
      /** the standard card (10px) */
      card: "rounded-9",
      /** rulebook detail, new-rule form, screen-failure (12px) */
      emphasis: "rounded-10",
      /** a card nested inside another card (8px) */
      nested: "rounded-7",
    },
    /*
     * The tinted semantic block: a `-surface` GROUND fenced by the pale
     * `-border` hairline of the SAME family. The export hand-spells the pair 84
     * times and only 50 use the family's `-border` — the rest reach for the
     * saturated base colour (`border-state-halt bg-state-halt-surface`) or
     * leave the edge to whatever the container had, so one meaning is drawn at
     * three hairline strengths depending on which file you open.
     *
     * `none` carries the neutral panel rather than the base class, so the tones
     * are mutually exclusive strings and not a merge race — the gate asserts
     * this cva output directly, where `cn` has not run.
     */
    tone: {
      none: "bg-surface-panel border-line-strong",
      action: "bg-action-surface border-action-border",
      attend: "bg-state-attend-surface border-state-attend-border",
      halt: "bg-state-halt-surface border-state-halt-border",
      settled: "bg-state-settled-surface border-state-settled-border",
    },
    /*
     * The accent stripe — 2px, TOP edge, inside the card's own border box. It
     * marks "this block is the live one". It is NOT the severity axis, which is
     * a 4px LEFT edge on a banner (`--stroke-severity`, still worn by
     * GateBanner, GapCard and the two failure banners). This variant drew that
     * left edge until now, so an accented card rendered as a severity banner
     * and competed for alarm with the real ones on the same screen — six call
     * sites, none of which meant severity. `settled` takes a stripe for that
     * same reason: being the live block and being a problem are different
     * claims, and only the second one is an alarm.
     */
    accent: {
      none: "",
      action: "border-t-(length:--stroke-accent) border-t-action",
      attend: "border-t-(length:--stroke-accent) border-t-state-attend",
      halt: "border-t-(length:--stroke-accent) border-t-state-halt",
      settled: "border-t-(length:--stroke-accent) border-t-state-settled",
    },
    /*
     * PROVISIONAL — proposed, with no document behind it yet. A solid hairline
     * is the design's mark of a settled thing, so drawing a proposal solid
     * presents a claim as a finding: §4.1 lost by default rather than by
     * argument. Style, not colour, because §4.2 needs the distinction to
     * survive greyscale.
     */
    dashed: { true: "border-dashed", false: "" },
  },
  defaultVariants: { size: "card", tone: "none", accent: "none", dashed: false },
});

type CardVariants = VariantProps<typeof cardClasses>;

/** The semantic families a card can wear, on either the ground or the stripe. */
export type CardTone = NonNullable<CardVariants["tone"]>;

export interface CardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "className">,
    CardVariants {
  children: ReactNode;
  className?: string;
}

export function Card({ size, tone, accent, dashed, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(cardClasses({ size, tone, accent, dashed }), className)}
      {...rest}
    />
  );
}

interface BandProps extends Omit<HTMLAttributes<HTMLDivElement>, "className"> {
  children: ReactNode;
  /** The neutral fill the design uses on header and footer bands. */
  filled?: boolean;
  className?: string;
}

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
