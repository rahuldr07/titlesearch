import { cx } from "../../components/ui/cx";

/**
 * THE 18-DOT PROGRESS METER (design §Screens 4 and 7).
 *
 * ══ WHY DOTS AND NOT A BAR ══════════════════════════════════════════════════
 *
 * A percentage bar is a THROUGHPUT DISPLAY: it invites "how fast is the bar
 * moving", which is the vocabulary AGENTS.md bans outright ("no throughput
 * counters anywhere") and `vocabulary.test.ts` gates. Dots are countable and
 * static — a reviewer reads "9 of 18 settled", not a rate.
 *
 * ══ THE COUNTS ARE THE SERVER'S, AND SO IS THE SENTENCE ═════════════════════
 *
 * `settled` and `total` arrive counted. This component does not filter a field
 * array by state to get them: `INVARIANTS` §1 and AGENTS.md both say the UI
 * "never re-derives counts", and rule 11 says numbers reconcile across screens —
 * two screens each doing their own filtering is precisely two literals.
 *
 * The DOTS, however, are drawn from those two numbers, and that is not a
 * derivation of state — it is the same number rendered as marks instead of as
 * digits. The label prints the counts verbatim beside them so the two can be
 * checked against each other by eye.
 */
export type ProgressMeterProps = {
  /** Decisions settled. Server-counted. */
  readonly settled: number;
  /** Decisions in total. Server-counted. */
  readonly total: number;
  /** What is being counted, e.g. "decisions settled". Sentence case, rule 4. */
  readonly noun: string;
  readonly className?: string | undefined;
};

/** The design draws eighteen. A fixed track, so two orders are comparable. */
const DOTS = 18;

export function ProgressMeter({ settled, total, noun, className }: ProgressMeterProps) {
  /*
   * How many of the eighteen are filled. Integer division, floored, so the
   * track NEVER shows a full row until the count is genuinely complete — a
   * meter that rounds 17/18 up to done is a meter that lies at the one moment
   * anybody is looking at it. `total === 0` fills none rather than dividing.
   */
  const filled = total === 0 ? 0 : Math.floor((settled / total) * DOTS);

  return (
    <div
      data-progress-meter
      data-settled={settled}
      data-total={total}
      className={cx("flex flex-col gap-4", className)}
    >
      <div
        role="img"
        aria-label={`${settled} of ${total} ${noun}`}
        className="flex items-center gap-2"
      >
        {Array.from({ length: DOTS }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={cx(
              "size-4 rounded-pill",
              i < filled ? "bg-state-settled" : "bg-line-strong",
            )}
          />
        ))}
      </div>
      {/* Rule 3: the counts are data, so they are mono. The noun is not. */}
      <span className="font-sans text-meta leading-close text-ink-secondary">
        <span className="font-mono tabular-nums text-ink-primary">
          {settled} of {total}
        </span>{" "}
        {noun}
      </span>
    </div>
  );
}
