import type { FieldState } from "@titlepipe/contract";
import { cx } from "../../components/ui";

/**
 * `Field.state`, rendered verbatim — the server owns every transition and
 * threshold, and the UI never computes state from confidence or from
 * `value === null`. The prop is `state`, not `field`, on purpose: a whole
 * Field would put `engine_confidence_raw` in scope, and the demotion this
 * rule keeps being broken by ("confirmed, but low confidence, so amber")
 * would be one expression away and would typecheck.
 */
export type StatePillProps = {
  readonly state: FieldState;
  readonly className?: string | undefined;
};

/**
 * One status signal per row — a mark plus weight, no fill; tinted capsules
 * are reserved for moments of record. A record for the same reason
 * noValueStates.ts is one: the six members must differ in every channel, and
 * a table can be read at a glance to check that.
 */
const PILL: Readonly<Record<FieldState, { mark: string; label: string; chrome: string }>> = {
  /** The pipeline has not ruled yet. Resting, receding, no weight. */
  pending: { mark: "•", label: "Pending", chrome: "text-ink-muted font-normal" },
  /**
   * No human saw this. Settled-muted rather than settled: the resting tier, per
   * the token file's "a ✓ on a row you are not being asked to act on".
   */
  auto_confirmed: {
    mark: "✓",
    label: "Auto-confirmed",
    chrome: "text-state-settled font-normal",
  },
  /** The ask. Attend family — look at this. */
  needs_review: {
    mark: "◆",
    label: "Needs review",
    chrome: "text-state-attend font-semibold",
  },
  /** A person ruled it correct. Full settled weight. */
  confirmed: { mark: "✓", label: "Confirmed", chrome: "text-state-settled font-semibold" },
  /** A person changed it. Settled, and distinguished by its own sentence. */
  corrected: { mark: "✓", label: "Corrected", chrome: "text-state-settled font-semibold" },
  /** Stopped, and it stays stopped until a rule resolves it. */
  escalated: { mark: "◆", label: "Escalated", chrome: "text-state-halt font-semibold" },
};

export function StatePill({ state, className }: StatePillProps) {
  const pill = PILL[state];
  return (
    <span
      data-field-state={state}
      className={cx(
        "inline-flex items-center gap-3 font-sans text-label leading-flat whitespace-nowrap",
        pill.chrome,
        className,
      )}
    >
      <span aria-hidden className="font-mono">
        {pill.mark}
      </span>
      {pill.label}
    </span>
  );
}
