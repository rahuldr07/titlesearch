import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./classNames";

/**
 * The container, ~35 instances.
 *
 * RULE: DEPTH SEPARATES, HAIRLINES DIVIDE. This REVERSES the previous rule and
 * is the single change that most separates the new register from the old. The
 * mockup stacks ground → sheet → card → card-high with three soft ink-tinted
 * shadows and draws no outer edge on a neutral container at all: `.rows`,
 * `.next`, `.decision` and `.matrix-wrap` each carry `--sh-1`/`--sh-2` and
 * nothing else. A 1px rule survives only INSIDE the card — header from body
 * from footer, in `--color-line-subtle`. FAILURE PREVENTED: a card fenced in
 * `--color-line-strong` (#D9D1BC, DARKER than the ground #E3DCCA) reads as a
 * boxed table cell on warm paper — every panel outlined, nothing layered.
 *
 * A TINTED card keeps its 1px edge: there the edge is the SEMANTIC mark, not
 * the boundary — the greyscale half of the accent/halt resolution (tokens.css
 * §3), where halt is a firmly outlined object and action an unoutlined tint.
 * Ground and edge stay on ONE axis (`tone`): the failure prevented is a
 * mismatched pair, which a two-prop component cannot prevent.
 */
/**
 * `shrink-0` IS A BUG FIX, NOT A DEFAULT — and it has to live here, on the base,
 * because the thing that causes the bug also lives here.
 *
 * `overflow-hidden` gives every card `min-height: 0`. That matters because a
 * flex item's default `min-height: auto` is the ONLY thing stopping it being
 * squeezed below its own content: cards opt out of that protection by being
 * cards. So any card inside a `flex-col` whose siblings want more room than
 * there is gets compressed toward nothing — silently, with its content still in
 * the DOM and still readable to a test.
 *
 * FOUND ON REVIEW, by measuring rather than by any assertion: in the report
 * scroller the signature record rendered 2px tall wanting 817, and `OrderRail`
 * rendered at ZERO wanting 268. The rail had been invisible there for some time
 * while THREE harvested invariants asserted against it — `toContainText` passes
 * happily on a zero-height element, which is exactly why nothing caught it.
 *
 * A card is a bounded box of content. There is no case where the right answer is
 * to crush one to a sliver rather than let its container scroll, which is what
 * the container is for. A card that genuinely must flex can still say so — a
 * `className` of `shrink` or `min-h-0` overrides this, because `cn` merges last.
 */
/* eslint-disable-next-line react-refresh/only-export-components -- exported so the variant logic is testable as a pure function in the node gate; a mutation audit showed component tests alone never caught a collapsed variant set. */
export const cardClasses = cva("overflow-hidden shrink-0", {
  variants: {
    /* Size carries RADIUS AND ELEVATION together: here they are one decision,
       how far off the page the thing sits. Re-imposed against the mockup's
       radius system — chip 3 · button 5 · card 8 · panel 14, 10 for its card. */
    size: {
      /** the standard container — 8px, `--sh-1` */
      card: "rounded-8 shadow-card",
      /** rulebook detail, new-rule form, screen-failure — 10px, `--sh-2` */
      emphasis: "rounded-9 shadow-pop",
      /** a card nested inside another card — 7px, and an inner well NEVER floats */
      nested: "rounded-7",
    },
    /*
     * The tinted semantic block: a `-surface` GROUND fenced by the pale
     * `-border` hairline of the SAME family. The export hand-spells the pair 84
     * times, only 50 with the family's own `-border`, so one meaning is drawn at
     * three strengths. `none` carries the ground ALONE — the shadow separates.
     */
    tone: {
      none: "bg-surface-panel",
      action: "border border-action-border bg-action-surface",
      attend: "border border-state-attend-border bg-state-attend-surface",
      halt: "border border-state-halt-border bg-state-halt-surface",
      settled: "border border-state-settled-border bg-state-settled-surface",
    },
    /* The accent stripe — 2px, TOP edge, inside the card's own border box. It
       marks "this block is the live one", and is NOT the severity axis: a 4px
       LEFT edge on a banner (`--stroke-severity`, worn by GateBanner, GapCard
       and the two failure banners). This variant drew that left edge until
       recently, so an accented card competed for alarm with the real banners.
       `settled` takes a stripe too: live and alarming are different claims. */
    accent: {
      none: "",
      action: "border-t-(length:--stroke-accent) border-t-action",
      attend: "border-t-(length:--stroke-accent) border-t-state-attend",
      halt: "border-t-(length:--stroke-accent) border-t-state-halt",
      settled: "border-t-(length:--stroke-accent) border-t-state-settled",
    },
    /* PROVISIONAL — proposed, with no document behind it yet. A solid edge is
       this design's mark of a settled thing, so drawing a proposal solid
       presents a claim as a finding: §4.1 lost by default, not by argument.
       Style, not colour, because §4.2 needs it to survive greyscale. */
    dashed: { true: "border-dashed", false: "" },
  },
  compoundVariants: [
    /* An untinted inner well: no shadow (nothing nested floats) and no tone
       edge, so without this it has no boundary. The mockup draws it as
       `inset 0 0 0 1px var(--line-soft)` — an INSET ring, so the well does not
       grow by 2px inside a parent whose padding is already spelled. */
    {
      size: "nested",
      tone: "none",
      dashed: false,
      class: "inset-ring inset-ring-line-subtle",
    },
    /* Provisional AND untinted. `dashed` sets a border-STYLE only; with no tone
       there is no width or colour to act on and the mark renders nothing.
       `--color-line-dashed` is the token built for it — heavier than the rule,
       so it survives being broken into segments. */
    { tone: "none", dashed: true, class: "border border-line-dashed" },
  ],
  defaultVariants: { size: "card", tone: "none", accent: "none", dashed: false },
});

type CardVariants = VariantProps<typeof cardClasses>;

/** The semantic families a card can wear, on either the ground or the stripe. */
export type CardTone = NonNullable<CardVariants["tone"]>;

export interface CardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "className">, CardVariants {
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

/*
 * Re-exported so `Card` stays the single import for a card and its bands —
 * splitting a file should not make every call site name two. The bands and
 * their one interior rule live in `CardBands.tsx`.
 */
export { CardHeader, CardFooter, CardBody } from "./CardBands";
