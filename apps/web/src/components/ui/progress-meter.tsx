import { ProgressBar } from "react-aria-components";
import { cx } from "./cx";

/**
 * The dot meter the screens use; progress.tsx keeps the bar for continuous
 * quantities. Dots because the quantity is countable and small — eighteen
 * dots say "fourteen of eighteen", which a bar cannot.
 *
 * The count comes from the server and is never derived here: there is no
 * `items` prop a length could be taken from, and no `percent` — a second
 * literal for the same fact would disagree the first time a field was added
 * mid-order. Above MAX_DOTS the meter draws no graphic and shows the mono
 * count alone; a bar rounded to the nearest twentieth is a number the screen
 * would then disagree with. react-aria's ProgressBar supplies the role and
 * aria-value wiring, so a screen reader hears "14 of 18", not eighteen spans.
 */

/** Above this the dots stop being countable and a bar is the honest drawing. */
const MAX_DOTS = 24;

export type ProgressMeterProps = {
  readonly label: string;
  /** From the server. Never `items.filter(...).length`. */
  readonly settled: number;
  /** From the server. Never `items.length`. */
  readonly total: number;
  /** The mono "N of M decisions settled" line. Counts are data. */
  readonly caption?: string | undefined;
};

export function ProgressMeter({ label, settled, total, caption }: ProgressMeterProps) {
  const safeTotal = Math.max(total, 0);
  const safeSettled = Math.min(Math.max(settled, 0), safeTotal);

  return (
    <ProgressBar
      data-slot="progress-meter"
      aria-label={label}
      value={safeSettled}
      minValue={0}
      maxValue={Math.max(safeTotal, 1)}
      className="flex flex-col gap-4"
    >
      {safeTotal <= MAX_DOTS && (
        <div data-slot="progress-meter-dots" className="flex flex-wrap gap-3">
          {Array.from({ length: safeTotal }, (_unused, index) => (
            <span
              key={index}
              aria-hidden
              className={cx(
                "tp-state size-5 rounded-pill",
                index < safeSettled ? "bg-state-settled" : "bg-line-strong",
              )}
            />
          ))}
        </div>
      )}
      {caption !== undefined && (
        <span className="font-mono text-label leading-flat text-ink-secondary">{caption}</span>
      )}
    </ProgressBar>
  );
}
