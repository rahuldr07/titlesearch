import { Chip } from "../../shared/ui/Chip";
import { cn } from "../../shared/ui/classNames";

/**
 * The pipeline, stage by stage, each tagged with who it is stopped on.
 *
 * PHASE COMES FROM THE SERVER. `design-classification.md` C3 records the export
 * computing `done/gate/wait` in the browser, which is a client-side state
 * machine and forbidden by hard constraint 9. This component renders `phase`
 * and cannot derive it — there is no ordering logic here, not even "the stage
 * after a halted one is waiting".
 *
 * A11y: the pulse is NOT the only signal. Every stage carries its phase as
 * text in the badge, so a reader who cannot see motion — or who has
 * `prefers-reduced-motion` set, which kills the animation globally — gets the
 * same information. Motion that is the sole carrier of meaning is an
 * accessibility failure, and the design's own framing supports this: the badge
 * text is what names the stage.
 */
export type StagePhase = "done" | "gate" | "halted" | "waiting";

const DOT: Record<StagePhase, string> = {
  done: "border-state-settled bg-state-settled text-ink-on-action",
  // A person must act. Pulses.
  gate: "border-action bg-action-surface text-action animate-tp-pulse",
  // Stopped, actionable. Pulses.
  halted: "border-state-halt bg-state-halt-surface text-state-halt animate-tp-pulse",
  waiting: "border-line-strong bg-surface-app text-ink-muted",
};

const GLYPH: Record<StagePhase, string> = {
  done: "✓",
  gate: "!",
  halted: "!",
  waiting: "·",
};

const BADGE_TONE = {
  done: "settled",
  gate: "action",
  halted: "halt",
  waiting: "neutral",
} as const satisfies Record<StagePhase, "settled" | "action" | "halt" | "neutral">;

export interface Stage {
  id: string;
  title: string;
  /** What is happening, in words. */
  detail: string;
  /** Server-supplied. Never computed from position in the list. */
  phase: StagePhase;
  /** Who it is stopped on — "the machine", "a reviewer", "intake". */
  stoppedOn: string;
}

export function StageList({ stages }: { stages: readonly Stage[] }) {
  return (
    <ol className="flex flex-col">
      {stages.map((stage) => (
        <li key={stage.id} className="flex gap-6 border-t border-line-subtle py-6 first:border-t-0">
          <span
            aria-hidden
            className={cn(
              "mt-1 flex size-11 shrink-0 items-center justify-center rounded-full",
              "border-(length:--stroke-emphasis) font-mono text-xs font-semibold",
              DOT[stage.phase],
            )}
          >
            {GLYPH[stage.phase]}
          </span>

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-md font-semibold text-ink-primary">{stage.title}</span>
              {/* The phase as TEXT — the pulse is never the only signal. */}
              <Chip tone={BADGE_TONE[stage.phase]} size="micro">
                {stage.phase}
              </Chip>
            </div>
            <p className="mt-1 text-base text-ink-secondary">{stage.detail}</p>
            <p className="mt-1 text-xs text-ink-muted">Stopped on {stage.stoppedOn}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
