import type { Rule } from "@titlepipe/contract";
import { cx } from "../../components/ui";

/**
 * A RULE, AND WHETHER IT CAN AFFECT ANYTHING.
 *
 * `INVARIANTS:38`: "A drafted rule lands PENDING and renders VISIBLY INERT — it
 * cannot affect the pipeline until an engineer confirms." AGENTS.md says the
 * same: "PENDING rules cannot affect the pipeline until engineer-confirmed."
 *
 * "Visibly inert" is the whole design of this pill. A PENDING rule is not drawn
 * as a live rule in a paler colour — it is drawn dashed and struck, so that a
 * reviewer scanning a catalog cannot mistake it for something that is currently
 * doing anything. The sentence is stated as well as the styling, because a
 * dashed border alone is a convention a new reviewer has not learned yet.
 *
 * `retired` is inert too, and for the opposite reason — it USED to bind. Given
 * its own render rather than folded in with pending, because "not yet" and "not
 * any more" send a reviewer to different places.
 */
export type RulePillProps = {
  readonly code: Rule["code"];
  readonly status: Rule["status"];
  readonly className?: string | undefined;
};

const STATUS = {
  /** Binding now. A solid hairline, ordinary graphite — rule 6, no capsule. */
  live: {
    chrome: "border-solid border-line-strong text-ink-primary",
    note: null,
  },
  pending: {
    chrome: "border-dashed border-state-attend-border text-state-attend line-through",
    note: "Inert until an engineer confirms it",
  },
  retired: {
    chrome: "border-dotted border-control-border text-ink-muted line-through",
    note: "No longer binding",
  },
} as const;

export function RulePill({ code, status, className }: RulePillProps) {
  const pill = STATUS[status];
  return (
    <span
      data-rule-code={code}
      data-rule-status={status}
      className={cx("inline-flex items-baseline gap-4", className)}
    >
      {/* Rule 3: a rule code is a reference, so it is mono. */}
      <span
        className={cx(
          "inline-flex items-center rounded-pill border px-4 py-1",
          "font-mono text-label leading-flat",
          pill.chrome,
        )}
      >
        {code}
      </span>
      {pill.note !== null && (
        <span className="font-sans text-label leading-close text-ink-muted">{pill.note}</span>
      )}
    </span>
  );
}
