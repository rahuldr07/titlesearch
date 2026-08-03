import { cva } from "class-variance-authority";
import { cn } from "./classNames";

/**
 * THE PRODUCT MARK — a wax seal and the word, set in the display serif.
 *
 * ONE MARK, TWO PLACES. The rail's brand and the sign-in screen's are the same
 * object at two sizes, because they were the same object drawn twice and had
 * already drifted: the rail carried a three-bar "pipe seen end-on" glyph over
 * `TITLEPIPE` in tracked caps with an `ABSTRACTOR REVIEW` sub-line, and sign-in
 * carried a larger copy of the same bars over the same caps. Neither is what the
 * approved mockup draws, and the caps setting in particular fought the design's
 * whole voice — a product whose h1 is a variable serif announcing itself in
 * letter-spaced sans is announcing a different product.
 *
 * THE SEAL IS RING-GAP-DOT, AND THE GAP IS THE PARENT'S PAPER. The mockup draws
 * it with `box-shadow: 0 0 0 2.5px var(--sheet-dim), 0 0 0 3.5px var(--accent)`
 * — a ring whose separating gap is painted the SIDEBAR's colour, which is
 * correct exactly once and wrong on the sign-in card (a brighter surface). Built
 * here as a bordered box with padding instead, so the gap is whatever paper the
 * mark is actually standing on and the same component is honest on both.
 *
 * `Pipe` IS ITALIC AND WAX, `Title` is upright ink. That contrast is the mark —
 * it is why this needs no logo file, and why it survives a palette change: both
 * halves are tokens.
 *
 * PRESENTATIONAL, AND NOT A LINK. The rail wraps it in a `Link` to the hub;
 * sign-in must not, because there is nowhere to go before you are signed in.
 * Putting the anchor inside would have given the sign-in screen a second control
 * on a page whose entire argument is that it has exactly one.
 */
const seal = cva("shrink-0 rounded-pill border border-action", {
  variants: {
    size: {
      /* 16px outer, 1px ring, 2px gap → a 10px dot. The mockup's 9px, rounded
         onto the 2px grid so the whole mark stays on it. */
      rail: "size-8 p-1",
      /* Sign-in reads at arm's length from a page with nothing else on it. */
      hero: "size-14 p-1.5",
    },
  },
});

const word = cva("font-display font-strong text-ink-primary opsz-40", {
  variants: {
    size: {
      rail: "text-3xl leading-flat",
      hero: "text-5xl leading-flat",
    },
  },
});

export interface WordmarkProps {
  size: "rail" | "hero";
  className?: string;
}

export function Wordmark({ size, className }: WordmarkProps) {
  return (
    /*
     * BASELINE, not centre. The seal is a small round object beside a large
     * serif word; centring the two puts the dot visually high, because a
     * lowercase-heavy word's optical centre sits below its box's. The mockup
     * aligns on the baseline and nudges the seal up a hair — the nudge is the
     * one part not reproduced, since a 1px translate is not worth an escape
     * hatch and the difference is invisible at both sizes.
     */
    <span className={cn("inline-flex items-baseline gap-5", className)}>
      <span aria-hidden className={cn(seal({ size }))}>
        <span className="block size-full rounded-pill bg-action" />
      </span>
      {/*
        ONE TEXT NODE, so a screen reader says "TitlePipe" and not "Title, Pipe".
        The italic half is a nested span rather than a sibling for the same
        reason: `<i>` inside the word keeps it one accessible name, where two
        adjacent spans are announced as two words by some readers.
      */}
      <span className={cn(word({ size }))}>
        Title<i className="font-book text-action">Pipe</i>
      </span>
    </span>
  );
}
