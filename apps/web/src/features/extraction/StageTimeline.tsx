import type { PipelineStage } from "@titlepipe/contract";
import { cx } from "../../components/ui";

/**
 * One row per `PipelineStage`, in the order the server sent them. Nothing here
 * sorts, renumbers, or decides a stage is running because the one before it is
 * done — `phase` arrives already decided. `label`, `detail` and `owner` print
 * verbatim: a client-side copy of product copy would drift silently. The count
 * chip prints the server's composed string — never a numeral parsed back out
 * of `detail`; a null count falls back to `owner`, in sans because it is a
 * word, not data.
 */
const PHASE: Readonly<
  Record<PipelineStage["phase"], { mark: string; ink: string; ring: string }>
> = {
  done: { mark: "✓", ink: "text-state-settled", ring: "border-state-settled-muted" },
  running: { mark: "•", ink: "text-action animate-tp-pulse", ring: "border-action-border" },
  halted: { mark: "◆", ink: "text-state-halt", ring: "border-state-halt-border" },
  waiting: { mark: "•", ink: "text-ink-faint", ring: "border-line-strong" },
};

export function StageTimeline(props: { readonly stages: readonly PipelineStage[] }) {
  return (
    <ol data-testid="stage-timeline" className="relative flex flex-col gap-10">
      {/* The rail stops short of the first and last dot so it reads as a
          connector rather than a border; every dot below is `relative` and
          paints over it. */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-5 bottom-5 left-5 w-1 bg-line-subtle"
      />
      {props.stages.map((stage) => (
        <li
          key={stage.id}
          data-testid={`stage-${stage.id}`}
          data-phase={stage.phase}
          className="flex items-start gap-8"
        >
          <span
            aria-hidden
            className={cx(
              "relative flex h-10 w-10 shrink-0 items-center justify-center",
              "rounded-pill border-2 bg-surface-panel font-mono text-label leading-flat",
              PHASE[stage.phase].ring,
              PHASE[stage.phase].ink,
            )}
          >
            {PHASE[stage.phase].mark}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="font-sans text-body font-bold leading-close text-ink-primary">
              {stage.label}
            </span>
            <span className="font-sans text-meta leading-body text-ink-muted">
              {stage.detail}
            </span>
            {/* The phase word, for a reader who cannot see the mark. */}
            <span className="sr-only">{stage.phase}</span>
          </span>
          {stage.count === null ? (
            <span
              className={cx(
                "shrink-0 rounded-lg border border-line-strong bg-surface-sunken px-4 py-2",
                "font-sans text-meta font-bold leading-flat text-ink-secondary",
              )}
            >
              {stage.owner}
            </span>
          ) : (
            <span
              data-testid="stage-count"
              className={cx(
                "shrink-0 rounded-lg border border-line-strong bg-surface-sunken px-4 py-2",
                "font-mono text-meta font-bold leading-flat tabular-nums text-ink-secondary",
              )}
            >
              {stage.count}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
