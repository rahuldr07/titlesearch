import { ProgressBar } from "react-aria-components";
import { cx } from "./cx";

/**
 * PORTED FROM apps/web-v2's `ProgressMeter.tsx`. The registry's `progress` is a
 * BAR; the screens draw a dot meter, and they are not the same statement.
 * `progress.tsx` keeps the bar for continuous quantities. THIS is the one the
 * screens use.
 *
 * Design §Screens 4: "18-dot progress meter + 'N of M decisions settled'
 * (mono)". A dot meter rather than a bar because the quantity is COUNTABLE and
 * small. A bar says "about three quarters"; eighteen dots say "fourteen of
 * eighteen", and on a screen whose whole job is deciding eighteen specific
 * things, the second is the true statement. The reader can also see WHICH ones,
 * which a bar cannot express at all.
 *
 * ══ THE COUNT COMES FROM THE SERVER, AND THIS COMPONENT NEVER DERIVES IT ═════
 *
 * `settled` and `total` are both required and both are given. AGENTS.md: "UI
 * never computes `state` from confidence, never re-derives counts." Rule 11:
 * "Numbers reconcile across screens — one variable, never two literals." So
 * there is no `items` prop from which a length could be taken, and no
 * `percent`: a percentage is a second literal for the same fact and the two
 * would disagree the first time a field was added mid-order.
 *
 * `total` may exceed the dots drawn. Above `MAX_DOTS` the meter draws NO graphic
 * at all and shows the mono count alone. That is deliberate and it is the
 * second-best answer, not the first: a proportional bar needs a computed width,
 * a computed width needs an inline style or an arbitrary value, and
 * `check-rules.mjs` bans both. A count with no bar is honest; a bar rounded to
 * the nearest twentieth is a number the screen would then disagree with, which
 * rule 11 exists to prevent. If a long meter is genuinely wanted, use
 * `progress.tsx`, which owns that escape and documents it.
 *
 * Rule 7's glyph vocabulary is not violated by the dots: a dot here is a
 * QUANTITY GRAPHIC, not a status mark, and it carries no colour meaning beyond
 * settled/not. It is `aria-hidden` for the same reason.
 *
 * ACCESSIBILITY: react-aria's ProgressBar supplies role, aria-valuenow/min/max
 * and the label wiring, so a screen reader hears "14 of 18", not eighteen spans.
 */

/** Above this the dots stop being countable and a bar is the honest drawing. */
const MAX_DOTS = 24;

export type ProgressMeterProps = {
  readonly label: string;
  /** From the server. Never `items.filter(...).length`. */
  readonly settled: number;
  /** From the server. Never `items.length`. */
  readonly total: number;
  /** The mono "N of M decisions settled" line. Rule 3: counts are data. */
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
