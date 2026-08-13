import type { PipelineStage, StagePhase } from "@titlepipe/contract";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { ListRow } from "../../shared/ui/ListRow";
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
    /*
     * `interactive` is deliberately off. A stage is a statement about the run,
     * not a control — nothing here opens, and a hover tint would promise a
     * click that does not exist on the row a person is most likely to try it
     * on, the halted one.
     */
    <ListRow className={cn("flex items-center gap-7", ROW[stage.phase])}>
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
        <span className={cn("block text-md font-medium", TITLE[stage.phase])}>
          {stage.label}
        </span>
        <span className="mt-1 block text-xs text-ink-muted">{stage.detail}</span>
      </span>

      {/*
       * THE OWNER IS A CAPTION, NOT A BADGE — and WHERE THE MARKUP AND THE
       * RENDER DISAGREE, THE RENDER GOVERNS (design spec, 2026-07-30). The
       * artefact described here is the RENDERED export, which draws all three
       * owners as one plain uppercase label. Its MARKUP does not: `:508` fills
       * the owner pill from `s.badgeBg`/`s.badgeFg`, and `:2951-2954` gives
       * Automated a grey fill, LLM agent a violet tint and You a solid violet.
       * Those tones never reach the rendered artefact, so they are dead style
       * (fidelity audit D9) — not a treatment this file dropped.
       *
       * Ranking owners by colour would say a stage the machine runs is a
       * different KIND of thing from one you run, when the column is only
       * answering "who touches this one". The row's phase already carries every
       * state signal on this screen; a second coloured object competing with it
       * at the right edge is what made "waiting" read as a warning.
       * `StageRow.stories.tsx` asserts the three owners render one identical
       * class list, so the claim is a gate rather than a description.
       */}
      <Eyebrow variant="field" as="span" tone="strong" className="shrink-0">
        {stage.owner}
      </Eyebrow>
    </ListRow>
  );
}
