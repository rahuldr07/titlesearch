import type { Rule } from "@titlepipe/contract";
import { cx } from "../../components/ui";

/**
 * A rule, and whether it can affect anything. A pending rule renders visibly
 * inert — dashed and struck, never a live rule in a paler colour — and the
 * sentence is stated as well as the styling, because a dashed border alone
 * is a convention a new reviewer has not learned yet. `retired` is inert for
 * the opposite reason (it used to bind) and gets its own render: "not yet"
 * and "not any more" send a reviewer to different places.
 */
export type RulePillProps = {
  readonly code: Rule["code"];
  readonly status: Rule["status"];
  readonly className?: string | undefined;
};

const STATUS = {
  /** Binding now. A solid hairline, ordinary graphite — no capsule. */
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
      {/* A rule code is a reference, so it is mono. */}
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
