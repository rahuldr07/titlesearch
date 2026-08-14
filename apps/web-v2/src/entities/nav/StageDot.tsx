import { cn } from "../../shared/ui/classNames";

/**
 * ONE STAGE'S MARK: a green checkmark disc once the server says done, its
 * number otherwise, and a filled violet disc with a white numeral where you are
 * standing (`dotBd`/`dotBg`/`doneDisplay`, TitlePipe.dc.html:2930-2933).
 *
 * RULE: `done` IS THE SERVER'S CLAIM, never "you already walked past this
 * screen". FAILURE PREVENTED: a rail that ticks a stage off because the reader
 * visited it — progress nobody recorded is progress that is not real, and the
 * one place it would show first is the mark that says a step is finished.
 *
 * DONE WINS THE FILL, ACTIVE WINS THE OUTLINE — inverted from the previous
 * build on the 2026-08-01 mockup's authority, and the inversion is the correct
 * reading rather than a preference. A FINISHED step is a closed fact and reads
 * as a solid green disc with a white tick; the step you are STANDING ON is not
 * finished, and drawing it as the boldest filled object on the rail said it
 * was. Outlined-on-bright-paper at emphasis weight is the "you are here" mark:
 * it is the lightest disc in the column, so the ticks behind it stay the thing
 * your eye counts.
 *
 * ACTIVE WINS THE DISC, DONE STILL WINS THE GLYPH, and the glyph takes the
 * disc's own ink. That is what lets the one row that is both — active AND done
 * — still read: the outline says you are here, the tick inside it says the
 * server has recorded this stage finished, and neither claim is dropped.
 *
 * THE CURRENT DISC CARRIES A HALO (`shadow-stage-current`, the mockup's flat
 * 3px ring). It exists because the outlined-on-bright treatment above is the
 * LIGHTEST mark in the column by design, and against five other discs the
 * lightest thing can stop reading as deliberate. The ring separates it without
 * adding a second stroke weight — stroke already means "done" here — and is
 * pitched almost to invisibility so the ticks stay what the eye counts.
 *
 * PRESENTATIONAL — no router, no fetch (§6). Its own file because the rail was
 * carrying the whole vocabulary of the mark inside its map callback.
 */
export interface StageDotProps {
  /** Fixed position in the flow, 1-based — structural, not order data. */
  n: number;
  done: boolean;
  active: boolean;
}

export function StageDot({ n, done, active }: StageDotProps) {
  return (
    <span
      aria-hidden
      className={cn(
        /*
         * THE DISC OCCLUDES THE SPINE, and it takes all three of these to do it.
         * `StageLink` runs a 1px rule from the disc above to this one; the disc
         * has to cover the half that would otherwise cross the numeral.
         *
         *   - an OPAQUE FILL, so every branch below sets a background — including
         *     the resting one, which is the rail's own paper rather than "no
         *     fill". A transparent disc has nothing to occlude with.
         *   - `relative`, so it can be layered at all.
         *   - `z-(--z-raised)`, and this is the one that is not obvious. Each
         *     segment spans from the PREVIOUS row's centre to this one, so its
         *     top half sits over the previous row's disc — and its wrapper comes
         *     LATER in the DOM, so at `z-index: auto` it painted after and the
         *     line ran straight through five of the six numerals. Only the
         *     active disc looked right, because nothing was drawn over it. The
         *     mockup solves it the same way (`.step .dot { z-index: 1 }`).
         *
         * Found by looking at a 4x screenshot. Every test passed.
         */
        "relative z-(--z-raised) flex size-10 shrink-0 items-center justify-center rounded-pill border font-mono text-xs",
        /*
         * THE RAIL'S FAMILY, and the hierarchy had inverted without it. On the
         * dark column the app tokens measured: done 2.99:1 (nearly gone),
         * resting 13.18:1 and active 16.60:1 — two bright paper discs shouting
         * over the green tick that is the whole point of the flow rail. The
         * docblock above still describes the intent; these values restore it.
         *
         * ACTIVE IS RINGED, NOT WHITE. On paper the current disc was the
         * lightest thing in the column so the ticks behind it stayed countable;
         * on a dark ground "lightest" is the loudest thing on screen, so the
         * accent ring carries "you are here" and the fill stays the band.
         */
        active
          ? "border-(length:--stroke-emphasis) border-rail-accent bg-rail-active-surface text-rail-ink shadow-stage-current"
          : done
            ? "border-rail-settled bg-rail-settled text-rail-surface"
            : "border-rail-track bg-rail-surface text-rail-ink-muted",
      )}
    >
      {done ? "✓" : n}
    </span>
  );
}
