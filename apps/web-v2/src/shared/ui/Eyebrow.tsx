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
 * of 133 bare eyebrows, 70 are the muted tier and 26 are action-violet, which
 * marks "this is the current context". Violet is therefore never decorative
 * here — it means you are looking at the live step.
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
      field: "text-micro tracking-badge font-bold text-ink-muted",
      /** the kicker above an <h1> (14 uses) — violet marks the live step */
      screen: "text-tiny tracking-stamp font-semibold text-action",
      /** card-header band label (9 uses) */
      section: "text-xs tracking-label font-bold text-ink-primary",
      /** group heading over a list (7 uses) */
      group: "text-xs tracking-eyebrow font-bold text-ink-primary",
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
       * The catalogue card's tag (10px/.12em/700/violet, export :2214). It is
       * its own canonical combination and was previously reached by taking
       * `screen` and overriding two of its three axes at the call site — which
       * is how eight canonical combinations drift back into twenty-two.
       */
      cardTag: "text-tiny tracking-label font-bold text-action",
      /** caption under a mono numeral — deliberately unweighted (6 uses) */
      stat: "text-micro tracking-badge text-ink-muted",
    },
    /*
     * Tones use `-ink` values, not base state colours. An eyebrow is 9–11px
     * text and sits on the app background as often as on a panel, where the
     * base colours measure 3.83:1 (attend) and 4.26:1 (settled) — both below
     * AA. The `-ink` values measure 6.32 and 6.86 on the same surface, and
     * clear AA on panel, raised and sunken too.
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
