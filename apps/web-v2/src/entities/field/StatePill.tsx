import type { FieldState } from "@titlepipe/contract";
import { cx } from "../../components/ui/cx";

/**
 * `Field.state`, RENDERED VERBATIM.
 *
 * `enums.ts:3-8`: "The SERVER owns every transition and every threshold. The UI
 * renders `state` verbatim — it must never compute it from
 * `engine_confidence_raw`, from `value === null`, or from anything else."
 *
 * ══ WHY THE PROP IS `state` AND NOT `field` ═════════════════════════════════
 *
 * Handing this component a whole `Field` would put `engine_confidence_raw` in
 * scope, and the demotion this rule keeps being broken by ("confirmed, but the
 * confidence is low, so draw it amber") would then be one expression away and
 * would typecheck. It takes the ENUM MEMBER and nothing else, so there is no
 * confidence in scope to promote or demote with. That is the structural
 * impossibility asked for, and it is the whole prop design.
 *
 * `confidence_raw` is "Raw, unverified, documented-miscalibrated. Prioritization
 * signal only — never a gate" (`entities.ts:76`). A pill is a gate's face.
 */
export type StatePillProps = {
  readonly state: FieldState;
  readonly className?: string | undefined;
};

/**
 * Rule 6: one status signal per row — a mark (✓ ◆ •) plus WEIGHT. The tinted
 * capsules are reserved for "moments of record", so ordinary lifecycle states
 * are drawn as mark + ink + weight and carry no fill.
 *
 * A record for the same reason `noValueStates.ts` is one: the six members must
 * differ in every channel, and a table can be read at a glance to check that.
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
  /**
   * Stopped, and it stays stopped until a RULE resolves it (`INVARIANTS:36` —
   * "escalation resolution is REFUSED without a rule").
   */
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
