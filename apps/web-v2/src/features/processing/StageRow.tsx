import { Chip } from "../../shared/ui/Chip";
import { cn } from "../../shared/ui/classNames";
import type { PipelineStage, StagePhase } from "./pipelineStages";

/**
 * One stage of the run.
 *
 * THE MARK CARRIES THE STATE, NOT THE COLOUR ALONE — ✓ for done, ! for a stop,
 * blank for held. The design's one animation lives here too: the dot of a stage
 * that has stopped pulses, and only that one. Everything else is still, so the
 * pulse means "this is where the run is" without a legend.
 *
 * A HELD STAGE IS NOT A FAILED STAGE. Held rows recede to the muted tier
 * instead of taking a warning colour, because "extraction has not run yet"
 * costs nothing and is not something anyone should act on.
 */
const DOT: Record<StagePhase, string> = {
  done: "border-state-settled bg-state-settled text-ink-on-action",
  halted: "border-state-halt bg-state-halt-surface text-state-halt animate-tp-pulse",
  "awaiting-you": "border-action bg-action-surface text-action animate-tp-pulse",
  held: "border-line-strong bg-surface-panel text-ink-muted",
};

const ROW: Record<StagePhase, string> = {
  done: "bg-surface-panel",
  halted: "bg-state-halt-surface",
  "awaiting-you": "bg-action-surface",
  held: "bg-surface-panel",
};

const TITLE: Record<StagePhase, string> = {
  done: "text-ink-primary",
  halted: "text-state-halt-ink",
  "awaiting-you": "text-ink-primary",
  held: "text-ink-muted",
};

const MARK: Record<StagePhase, string> = {
  done: "✓",
  halted: "!",
  "awaiting-you": "!",
  held: "",
};

export function StageRow({ stage, gateHalted }: { stage: PipelineStage; gateHalted: boolean }) {
  const state = gateHalted ? stage.halted : stage.passed;

  return (
    <li
      className={cn(
        "flex items-center gap-7 border-t border-line-subtle px-8 py-6 first:border-t-0",
        ROW[state.phase],
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full",
          "border-(length:--stroke-emphasis) font-mono text-xs font-semibold",
          DOT[state.phase],
        )}
      >
        {MARK[state.phase]}
      </span>

      <span className="min-w-0 flex-1">
        <span className={cn("block text-md font-medium", TITLE[state.phase])}>{stage.title}</span>
        <span className="mt-1 block text-xs text-ink-muted">{state.sub}</span>
      </span>

      <Chip
        shape="pill"
        size="micro"
        bordered={stage.owner === "LLM agent"}
        tone={stage.owner === "You" ? "inverse" : stage.owner === "LLM agent" ? "action" : "neutral"}
      >
        {stage.owner}
      </Chip>
    </li>
  );
}
