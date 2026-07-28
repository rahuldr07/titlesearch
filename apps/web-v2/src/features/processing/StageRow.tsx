import type { PipelineStage, StagePhase } from "@titlepipe/contract";
import { Chip } from "../../shared/ui/Chip";
import { cn } from "../../shared/ui/classNames";

/**
 * One stage of the run.
 *
 * THE MARK CARRIES THE STATE, NOT THE COLOUR ALONE — ✓ for done, ! for a stop,
 * blank for waiting. The design's one animation lives here too: the dot of a
 * stage that has stopped pulses, and so does the one that is actually running.
 * Everything else is still, so the pulse means "this is where the run is"
 * without a legend.
 *
 * A WAITING STAGE IS NOT A FAILED STAGE. Waiting rows recede to the muted tier
 * instead of taking a warning colour, because "extraction has not run yet"
 * costs nothing and is not something anyone should act on.
 *
 * The four tones are keyed on the wire's own phase vocabulary. Nothing here
 * combines phase with owner to invent a fifth state: "waiting on you" against
 * "waiting on the gate" is a distinction the server would have to draw, and
 * drawing it here would be this screen deciding what the run is doing.
 */
const DOT: Record<StagePhase, string> = {
  done: "border-state-settled bg-state-settled text-ink-on-action",
  running: "border-action bg-action-surface text-action animate-tp-pulse",
  halted: "border-state-halt bg-state-halt-surface text-state-halt animate-tp-pulse",
  waiting: "border-line-strong bg-surface-panel text-ink-muted",
};

const ROW: Record<StagePhase, string> = {
  done: "bg-surface-panel",
  running: "bg-action-surface",
  halted: "bg-state-halt-surface",
  waiting: "bg-surface-panel",
};

const TITLE: Record<StagePhase, string> = {
  done: "text-ink-primary",
  running: "text-ink-primary",
  halted: "text-state-halt-ink",
  waiting: "text-ink-muted",
};

const MARK: Record<StagePhase, string> = {
  done: "✓",
  running: "!",
  halted: "!",
  waiting: "",
};

export function StageRow({ stage }: { stage: PipelineStage }) {
  return (
    <li
      className={cn(
        "flex items-center gap-7 border-t border-line-subtle px-8 py-6 first:border-t-0",
        ROW[stage.phase],
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full",
          "border-(length:--stroke-emphasis) font-mono text-xs font-semibold",
          DOT[stage.phase],
        )}
      >
        {MARK[stage.phase]}
      </span>

      <span className="min-w-0 flex-1">
        <span className={cn("block text-md font-medium", TITLE[stage.phase])}>{stage.label}</span>
        <span className="mt-1 block text-xs text-ink-muted">{stage.detail}</span>
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
