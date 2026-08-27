import type { Field } from "@titlepipe/contract";
import { cx } from "../../components/ui";

/**
 * THE ROW'S ONE STATUS SIGNAL (rule 6: "a mark ✓ ◆ • + weight … colored
 * capsules only at moments of record").
 *
 * This is NOT `StatePill`. The pill is the panel's full statement — mark, word,
 * weight — and it belongs on the open decision where there is room to read it.
 * The row has a 24px track, so it carries the mark plus the shortest true word,
 * and `review.spec` reads that word: "✎ corrected", "↗ escalated",
 * "✓ accepted N/A".
 *
 * ══ EVERY WORD HERE IS `state`, AND ONLY `state` ═══════════════════════════
 *
 * `enums.ts:3-8`: the UI renders `state` verbatim and "must never compute it
 * from `engine_confidence_raw`, from `value === null`, or from anything else".
 * So this component takes the two things the server said — `state` and
 * `na_reason` — and prints them. It does not read confidence, does not read
 * readings, and does not decide that a null value means anything.
 *
 * ══ WHY AN NA ACCEPTANCE READS DIFFERENTLY ═════════════════════════════════
 *
 * "✓ accepted N/A" rather than "✓ confirmed", because those are two different
 * acts and the row is the only place a reviewer sees them side by side. A
 * confirmed VALUE says the page says this; a confirmed ABSENCE says the page
 * says nothing, and rule 14 exists because collapsing that distinction is how
 * an absence ships as a fact. The state is unchanged either way — this reads
 * `na_reason`, which is the server's own statement about which act it was.
 *
 * ══ WHY QUEUED AND PENDING RENDER NOTHING ══════════════════════════════════
 *
 * `review.spec` asserts `row-mark` has COUNT 0 on an unruled field, five times
 * over, and it is right to: a mark means somebody or something settled this.
 * An empty 24px track is the honest render of "nobody has yet", and it is what
 * makes the marks that ARE there readable at a glance down the column.
 */
export type RowMarkProps = {
  readonly field: Field;
};

/**
 * The four settled renders. A record over `FieldState` minus the two unsettled
 * members, so a seventh state fails to compile here rather than silently
 * rendering nothing.
 */
const MARK: Readonly<
  Record<"auto_confirmed" | "confirmed" | "corrected" | "escalated", {
    mark: string;
    word: string;
    chrome: string;
  }>
> = {
  /** No human saw it. The resting tier — a ✓ you are not being asked to act on. */
  auto_confirmed: { mark: "✓", word: "auto", chrome: "text-state-settled-muted" },
  confirmed: { mark: "✓", word: "confirmed", chrome: "text-state-settled" },
  corrected: { mark: "✎", word: "corrected", chrome: "text-state-settled" },
  /** Stopped until a RULE resolves it (INVARIANT 36). Halt, not settled. */
  escalated: { mark: "↗", word: "escalated", chrome: "text-state-halt" },
};

export function RowMark({ field }: RowMarkProps) {
  if (field.state === "pending" || field.state === "needs_review") return null;

  const render = MARK[field.state];
  // The server said this field is an absence AND that a person settled it.
  const acceptedAbsence = field.na_reason !== null && field.state === "confirmed";

  return (
    <span
      data-testid="row-mark"
      data-field-state={field.state}
      className={cx(
        "flex items-center gap-2 whitespace-nowrap font-sans text-label leading-flat font-semibold",
        render.chrome,
      )}
    >
      <span aria-hidden className="font-mono">
        {render.mark}
      </span>
      {acceptedAbsence ? "accepted N/A" : render.word}
    </span>
  );
}
