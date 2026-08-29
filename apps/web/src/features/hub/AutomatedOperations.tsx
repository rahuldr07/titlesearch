import type { PipelineStage } from "@titlepipe/contract";
import { HubSectionLabel } from "./HubSectionLabel";

/**
 * The pipeline's own stages, drawn as the prototype's operation rows.
 *
 * Two refusals. The design titles the block "Zero Manual Touch" — false of the
 * two stages the pipeline stops on for a person, and `StageOwner` (`Automated` |
 * `LLM agent` | `You`) is what keeps a halted human stage from reading as a
 * machine that failed, so the owner holds the right-hand column. The design puts
 * a COUNT there; `PipelineStage` has no count member, and the figure lives
 * inside the server-composed `detail` sentence — parsing it out would be the
 * browser re-deriving a number it cannot cite. CONTRACT GAP, not filled here.
 */
export function AutomatedOperations(props: {
  readonly stages: readonly PipelineStage[] | undefined;
  readonly classifierNote: string | undefined;
  readonly gateHalted: boolean | undefined;
}) {
  return (
    <section className="flex flex-col gap-6 border-b border-line-subtle p-12">
      <HubSectionLabel>
        Automated operations
        {props.gateHalted === true && (
          // Server state (`intake.ts:99`) — never inferred from the stage list.
          <span
            data-testid="gate-halted"
            className="rounded-pill border border-state-halt-border bg-state-halt-surface px-5 py-1 text-label font-semibold leading-flat text-state-halt"
          >
            Gate halted
          </span>
        )}
      </HubSectionLabel>

      {props.stages === undefined ? (
        <p className="text-meta leading-body text-ink-muted">
          The server has not described this order's run.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {props.stages.map((stage) => (
            <li
              key={stage.id}
              data-stage={stage.id}
              data-phase={stage.phase}
              className="flex items-center gap-6 rounded-lg p-5 hover:bg-surface-sunken"
            >
              <span
                aria-hidden
                className={`flex size-10 shrink-0 items-center justify-center rounded-pill font-mono text-label font-bold leading-flat ${MARK[stage.phase].skin}`}
              >
                {MARK[stage.phase].glyph}
              </span>
              <span className="sr-only">{stage.phase}</span>
              <span className="min-w-0 flex-1 text-meta font-semibold leading-close text-ink-primary">
                {stage.label}{" "}
                {/* The server's sentence, with its own count already in it. */}
                <span className="font-normal text-ink-faint">· {stage.detail}</span>
              </span>
              <span className="shrink-0 text-meta leading-close text-ink-secondary">
                {stage.owner}
              </span>
            </li>
          ))}
        </ol>
      )}

      {props.classifierNote !== undefined && (
        <p className="text-meta leading-body text-ink-secondary">{props.classifierNote}</p>
      )}
    </section>
  );
}

/** Rule 7's closed glyph vocabulary — ✓ ◆ • and nothing else. No icons. */
const MARK = {
  done: { glyph: "✓", skin: "bg-state-settled-surface text-state-settled" },
  running: { glyph: "•", skin: "bg-action-surface text-action animate-tp-pulse" },
  halted: { glyph: "◆", skin: "bg-state-halt-surface text-state-halt" },
  waiting: { glyph: "•", skin: "bg-surface-sunken text-ink-muted" },
} as const;
