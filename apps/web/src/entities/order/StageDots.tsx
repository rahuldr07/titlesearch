import { cx } from "../../components/ui/cx";

/**
 * THE SEQUENTIAL STAGE TIMELINE (design §Screens 6, "Sequential stages
 * timeline (6 rows, live counts, all derived per order)").
 *
 * Every stage carries a SERVER-GIVEN status. This component does not infer
 * "the next one must be running because the last is done", and it does not
 * infer "done" from a count reaching a total: a stage that has processed every
 * page and then failed to write its output is complete by arithmetic and
 * failed in fact, and only the server knows which.
 *
 * There are four statuses and no fifth. `blocked` is deliberately NOT a
 * synonym for failed — it is a stage that cannot start, and rule 9 says it
 * states its reason.
 */
export type StageStatus = "waiting" | "running" | "done" | "blocked";

export type Stage = {
  readonly id: string;
  readonly label: string;
  readonly status: StageStatus;
  /**
   * The stage's own count line, e.g. "412 pages". Already composed by the
   * server; rule 11 wants one variable, not a second literal assembled here.
   */
  readonly note?: string | null | undefined;
};

export type StageDotsProps = {
  readonly stages: readonly Stage[];
  readonly className?: string | undefined;
};

/** Rule 7's glyph vocabulary — ✓ ◆ • and nothing else. No icons. */
const DOT: Readonly<Record<StageStatus, { mark: string; chrome: string }>> = {
  waiting: { mark: "•", chrome: "text-ink-muted" },
  /** The pulsing dot of §Screens 5. One animation token, honouring reduce. */
  running: { mark: "•", chrome: "text-action animate-tp-pulse" },
  done: { mark: "✓", chrome: "text-state-settled" },
  blocked: { mark: "◆", chrome: "text-state-halt" },
};

export function StageDots({ stages, className }: StageDotsProps) {
  return (
    <ol data-stage-dots className={cx("flex flex-col gap-5", className)}>
      {stages.map((stage) => (
        <li
          key={stage.id}
          data-stage={stage.id}
          data-stage-status={stage.status}
          className="flex items-baseline gap-5"
        >
          <span aria-hidden className={cx("font-mono text-body leading-flat", DOT[stage.status].chrome)}>
            {DOT[stage.status].mark}
          </span>
          <span className="font-sans text-meta leading-close text-ink-primary">
            {stage.label}
          </span>
          {/* The status word, for a reader who cannot see the mark. */}
          <span className="sr-only">{stage.status}</span>
          {typeof stage.note === "string" && stage.note.length > 0 && (
            <span className="ml-auto font-mono text-label leading-flat tabular-nums text-ink-muted">
              {stage.note}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
