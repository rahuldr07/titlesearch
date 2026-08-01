import { cva, type VariantProps } from "class-variance-authority";
import type { ElementType, LabelHTMLAttributes, ReactNode } from "react";
import { cn } from "./classNames";

/**
 * The uppercase letterspaced label — 133 bare instances, the design's single
 * most repeated typographic device. Every `<label>` in the export is the
 * `field` variant exactly.
 *
 * The variants are the design's eight canonical combinations collapsed to six;
 * the two that fold are colour-only shifts of `field`, which the `tone` axis
 * already expresses.
 *
 * `--color-ink-muted` is the default because the measured distribution says so:
 * of 133 bare eyebrows, 70 are the muted tier.
 *
 * THE ACCENT LEFT THIS TIER 2026-08-01, and that is the point of the reskin.
 * RULE: the sealing wax is spent ONCE per screen, on the one action. FAILURE
 * PREVENTED: `screen` used to paint the masthead kicker in the accent, so every
 * screen opened with a wax word above the title and a wax button below it, and
 * the button stopped reading as the thing to press. The mockup draws the kicker
 * muted (`— YOUR QUEUE`, `— ADMIN · CLIENTS`) and keeps the wax for the press.
 * `cardTag` is the one survivor: it names the catalogue card's own subject, and
 * no card carries an action.
 *
 * The metrics moved too. The mockup's 700-weight micro-caps tier is tracked
 * .16–.18em throughout (`AS READ`, `PRODUCT`, `NEXT ORDER IN LINE`); .12em is
 * its CHIP tracking, which is where `field` had drifted to.
 */
/**
 * Each variant carries its own drawn colour, so a caller gets the design's
 * appearance without restating it. `tone` overrides that colour because cva
 * emits variants in declaration order and our configured tailwind-merge
 * resolves the two text-colours last-wins while leaving the size token intact
 * (verified — see classNames.ts). cva `compoundVariants` cannot express
 * "when tone is unset", which is why the default lives in the class instead.
 */
const eyebrow = cva("uppercase", {
  variants: {
    variant: {
      /** key-value row labels, and every <label> in the design (33 uses) */
      field: "text-micro tracking-eyebrow font-bold text-ink-muted",
      /** the kicker above an <h1> (14 uses) — muted since the wax reskin */
      screen: "text-xs tracking-eyebrow font-semibold text-ink-muted",
      /** card-header band label (9 uses) — the mockup's band head is ink-2 */
      section: "text-xs tracking-label font-bold text-ink-secondary",
      /** group heading over a list (7 uses) — the mockup's nav group label */
      group: "text-micro tracking-caps font-semibold text-ink-muted",
      /** inline caption beside a value (7 uses) */
      caption: "text-micro tracking-label font-bold text-ink-muted",
      /**
       * A heading INSIDE a card, one step up from the 9px row labels beneath
       * it — "Close it one of two ways", the review dock's block headings
       * (10px/.08em/700/ink3). Drawn at `field` it flattened into the label
       * column it is supposed to head. `.08em` has no token; `tracking-badge`
       * (.1em) is the nearest and the 0.02em is below the perceptual floor at
       * this size — the SIZE STEP is what carried the hierarchy.
       */
      cardHeading: "text-tiny tracking-badge font-bold text-ink-muted",
      /**
       * The catalogue card's tag (10px/.12em/700/accent, export :2214) — the
       * one accent that stayed in this tier, because it names the card's own
       * subject and no card carries an action. 7.66:1 on panel, 6.00:1 on the
       * app ground. It is its own canonical combination, previously reached by
       * taking `screen` and overriding two of its three axes at the call site —
       * which is how eight canonical combinations drift back into twenty-two.
       */
      cardTag: "text-tiny tracking-label font-bold text-action",
      /** caption under a mono numeral — deliberately unweighted (6 uses) */
      stat: "text-micro tracking-badge text-ink-muted",
    },
    /*
     * Tones use `-ink` values, not base state colours. An eyebrow is 9–11px
     * text and sits on the app background as often as on a panel, where the
     * 2026-08-01 base colours measure 3.77:1 (attend) and 4.13:1 (settled) —
     * both still below AA. The `-ink` values measure 4.95 and 5.96 on that same
     * worst-case ground, and clear AA on panel, raised and sunken too; in mocha
     * the same six run 4.92–11.03. Re-measured after the palette swap.
     */
    tone: {
      muted: "text-ink-muted",
      strong: "text-ink-primary",
      action: "text-action-ink",
      settled: "text-state-settled-ink",
      attend: "text-state-attend-ink",
      halt: "text-state-halt-ink",
    },
  },
  defaultVariants: { variant: "field" },
});

type EyebrowVariants = VariantProps<typeof eyebrow>;

/**
 * Extends label attributes rather than plain `HTMLAttributes` because every
 * `<label>` in the design IS this component, so `htmlFor` has to be reachable.
 * Full polymorphic generics would type that precisely per `as`, at a cost in
 * readability this presentational component does not earn (§6: simple beats
 * clever). The looseness is that `htmlFor` type-checks on a `<span>` too, where
 * React drops it harmlessly.
 */
export interface EyebrowProps
  extends Omit<LabelHTMLAttributes<HTMLElement>, "className">,
    EyebrowVariants {
  children: ReactNode;
  /** `label` when it names a control, `h2`/`h3` when it heads a section. */
  as?: ElementType;
  className?: string;
}

export function Eyebrow({ variant, tone, as, className, ...rest }: EyebrowProps) {
  const Tag = as ?? "span";
  return <Tag className={cn(eyebrow({ variant, tone }), className)} {...rest} />;
}
