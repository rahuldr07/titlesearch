import type { PipelineStage } from "@titlepipe/contract";
import { cx } from "../../components/ui";

/**
 * THE SEQUENTIAL STAGES TIMELINE (design §Screens 6).
 *
 * One row per `PipelineStage` (intake.ts:83) in the order the server sent
 * them. The screen does not sort, filter, renumber, or decide that a stage is
 * running because the one before it is done — `phase` arrives already decided
 * and `StagePhase` (intake.ts:77) has exactly four members. A stage that
 * processed every page and then failed to write its output is complete by
 * arithmetic and failed in fact, and only the server knows which.
 *
 * `label`, `detail` and `owner` are the server's words and are printed
 * verbatim. A client-side `Record<StageId, string>` would be a second copy of
 * product copy drifting silently from the first — the argument intake.ts:275
 * makes for `LifecycleStamp.label`, and the reason the design's own stage
 * captions are not hardcoded here.
 *
 * ══ THE DESIGN'S "LIVE COUNTS" AND "↺ REPLAY" ══════════════════════════════
 *
 * §Screens 6 asks for a live count per row and a Replay control. Neither is
 * built:
 *
 *   - `PipelineStage` carries no count field. The counts the design draws live
 *     inside `detail`, already composed by the server, and that is where they
 *     are rendered. Splitting a numeral back out of that sentence to set it in
 *     mono would be the client re-authoring a server string.
 *   - REPLAY IS A MUTATION AND NO ENDPOINT EXISTS. There is no re-run action
 *     in `PERMISSIONS` (authz.ts:59-118) and no replay route in the contract. A
 *     button that re-ran extraction is a state transition the server owns.
 *
 * Rule 7's glyph vocabulary carries the phase: ✓ done, • running/waiting,
 * ◆ halted. No icons, no fifth mark.
 */
const PHASE: Readonly<Record<PipelineStage["phase"], { mark: string; ink: string }>> = {
  done: { mark: "✓", ink: "text-state-settled" },
  running: { mark: "•", ink: "text-action animate-tp-pulse" },
  halted: { mark: "◆", ink: "text-state-halt" },
  waiting: { mark: "•", ink: "text-ink-faint" },
};

export function StageTimeline(props: { readonly stages: readonly PipelineStage[] }) {
  return (
    <ol data-testid="stage-timeline" className="flex flex-col">
      {props.stages.map((stage) => (
        <li
          key={stage.id}
          data-testid={`stage-${stage.id}`}
          data-phase={stage.phase}
          className="grid grid-cols-[20px_minmax(0,1fr)_110px] items-baseline gap-6 border-b border-line-subtle py-6 last:border-b-0"
        >
          <span
            aria-hidden
            className={cx("font-mono text-body leading-flat", PHASE[stage.phase].ink)}
          >
            {PHASE[stage.phase].mark}
          </span>
          <span className="flex min-w-0 flex-col gap-2">
            <span className="font-sans text-meta font-semibold leading-close text-ink-primary">
              {stage.label}
            </span>
            {/* The server's sentence, counts and all. Never re-composed. */}
            <span className="font-sans text-label leading-body text-ink-secondary">
              {stage.detail}
            </span>
            {/* The phase word, for a reader who cannot see the mark. */}
            <span className="sr-only">{stage.phase}</span>
          </span>
          <span className="font-sans text-label leading-flat text-ink-muted">
            {stage.owner}
          </span>
        </li>
      ))}
    </ol>
  );
}
