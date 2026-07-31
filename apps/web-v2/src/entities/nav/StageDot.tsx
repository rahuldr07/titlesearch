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
 * ACTIVE WINS THE DISC, DONE WINS THE GLYPH, and the glyph takes the disc's own
 * ink. The export leaves the tick green on the violet fill, which is a green
 * mark on a dark ground; the two rules are kept apart so the one row that is
 * both still reads at this size.
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
        "flex size-6 shrink-0 items-center justify-center rounded-pill border font-mono text-micro",
        active
          ? "border-action bg-action text-ink-on-action"
          : done
            ? "border-state-settled-border bg-state-settled-surface text-state-settled"
            : "border-line-strong text-ink-secondary",
      )}
    >
      {done ? "✓" : n}
    </span>
  );
}
