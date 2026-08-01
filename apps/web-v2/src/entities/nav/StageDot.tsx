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
        "flex size-10 shrink-0 items-center justify-center rounded-pill border font-mono text-xs",
        active
          ? "border-(length:--stroke-emphasis) border-ink-primary bg-surface-raised text-ink-primary"
          : done
            ? "border-state-settled bg-state-settled text-ink-on-action"
            : "border-line-dashed bg-surface-sunken text-ink-muted",
      )}
    >
      {done ? "✓" : n}
    </span>
  );
}
