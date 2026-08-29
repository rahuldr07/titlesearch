import type { PipelineStage } from "@titlepipe/contract";
import { cx } from "../../components/ui";

/**
 * THE SEQUENTIAL STAGES TIMELINE — one row per `PipelineStage` (intake.ts:83)
 * in the order the server sent them. Nothing here sorts, filters, renumbers, or
 * decides a stage is running because the one before it is done: `phase` arrives
 * already decided and `StagePhase` (intake.ts:77) has exactly four members.
 * `label`, `detail` and `owner` are printed verbatim — a client-side
 * `Record<StageId, string>` would be a second copy of product copy drifting
 * silently from the first.
 *
 * THE RIGHT-HAND CHIP CARRIES `owner`, NOT A COUNT. The design puts a count
 * there ("38 of 64 pages"); `PipelineStage` has no count member, and the
 * figures the design draws already live inside `detail`, composed by the
 * server. Splitting a numeral back out of that sentence to set it in mono is
 * the client re-authoring a server string. `owner` (`StageOwner`,
 * intake.ts:80) is sans rather than mono because rule 3 reserves mono for data
 * and "LLM agent" is a word.
 *
 * REPLAY IS REFUSED. The design draws a "↺ Replay" control beside the header.
 * It is a MUTATION, and there is no re-run action in `PERMISSIONS`
 * (authz.ts:59-118) and no replay route in the contract.
 *
 * Rule 7's glyph vocabulary carries the phase: ✓ done, • running/waiting,
 * ◆ halted. No icons, no fifth mark.
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
            {/* The server's sentence, counts and all. Never re-composed. */}
            <span className="font-sans text-meta leading-body text-ink-muted">
              {stage.detail}
            </span>
            {/* The phase word, for a reader who cannot see the mark. */}
            <span className="sr-only">{stage.phase}</span>
          </span>
          <span
            className={cx(
              "shrink-0 rounded-lg border border-line-strong bg-surface-sunken px-4 py-2",
              "font-sans text-meta font-bold leading-flat text-ink-secondary",
            )}
          >
            {stage.owner}
          </span>
        </li>
      ))}
    </ol>
  );
}
