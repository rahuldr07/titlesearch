import { cx } from "../../components/ui";

/**
 * The sequential stage timeline. Every stage carries a server-given status:
 * this component never infers "running" from the previous stage being done,
 * and never infers "done" from a count reaching a total — a stage that
 * processed every page and then failed to write its output is complete by
 * arithmetic and failed in fact, and only the server knows which. `blocked`
 * is deliberately not a synonym for failed: it is a stage that cannot start.
 */
export type StageStatus = "waiting" | "running" | "done" | "blocked";

export type Stage = {
  readonly id: string;
  readonly label: string;
  readonly status: StageStatus;
  /**
   * The stage's own count line, e.g. "412 pages". Already composed by the
   * server — one variable, not a second literal assembled here.
   */
  readonly note?: string | null | undefined;
};

export type StageDotsProps = {
  readonly stages: readonly Stage[];
  readonly className?: string | undefined;
};

/** The closed glyph vocabulary — ✓ ◆ • and nothing else. No icons. */
const DOT: Readonly<Record<StageStatus, { mark: string; chrome: string }>> = {
  waiting: { mark: "•", chrome: "text-ink-muted" },
  /** The pulsing dot. One animation token, honouring reduced motion. */
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
