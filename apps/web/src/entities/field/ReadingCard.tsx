import type { FieldReading } from "@titlepipe/contract";
import type { DiffSeg } from "./charDiff";

/**
 * One engine's pre-merge reading.
 *
 * `field_readings` is kept permanently so disagreements stay inspectable
 * forever (CONTEXT §6). This card is how a reviewer sees one.
 *
 * CONFIDENCE IS NOT A RECOMMENDATION. `confidence_raw` is the engine grading its
 * own work, documented as miscalibrated, and it is NEVER an auto-confirm gate on
 * the backend (CONTEXT §8.3). So it renders dimmed, last, alongside cost and
 * latency as one more piece of context — never as a score, never as a badge,
 * never sorted on, and never used to pre-select a reading. The label says so out
 * loud, because a bare number invites exactly the reading the rule forbids.
 */
export function ReadingCard({
  reading,
  seat,
  segments,
  onAdopt,
}: {
  reading: FieldReading;
  /** positional label only — A/B is the seat, not a ranking */
  seat: string;
  /** pre-diffed value; differing runs are marked */
  segments: readonly DiffSeg[];
  /**
   * Adopt this reading into the correction editor (orphan rule O11). Absent when
   * the reading has no value to adopt.
   */
  onAdopt?: (value: string) => void;
}) {
  return (
    <div
      data-testid={`reading-${reading.engine_id}`}
      className="rounded-md border border-line-strong bg-surface-panel p-3"
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-micro font-bold tracking-badge text-ink-muted uppercase">
          Reader {seat}
        </span>
        <span className="font-mono text-tiny text-ink-secondary">
          {reading.engine_id}
        </span>
        {reading.page === null ? null : (
          <span className="rounded-xs border border-page-ref-border bg-page-ref-surface px-1.5 py-px font-mono text-tiny font-semibold text-page-ref">
            p{reading.page}
          </span>
        )}
      </div>

      <div className="mt-1.5 font-mono text-md font-semibold break-words text-ink-primary">
        {reading.value === null ? (
          <span className="text-xs font-normal text-ink-muted italic">
            this engine returned nothing
          </span>
        ) : (
          segments.map((s, i) =>
            s.same ? (
              <span key={i}>{s.text}</span>
            ) : (
              // the divergence — what the reviewer is actually here to settle
              <mark
                key={i}
                data-testid="diff-hl"
                className="rounded-xs bg-surface-evidence px-px text-ink-primary"
              >
                {s.text}
              </mark>
            ),
          )
        )}
      </div>

      {reading.snippet === null ? null : (
        <div className="mt-1.5 border-l-2 border-line-strong pl-2 font-quote text-xs leading-relaxed text-ink-secondary">
          “{reading.snippet}”
        </div>
      )}

      {/*
        A READING IS ADOPTED, NEVER RETYPED (orphan rule O11).
        Transcription is itself an error channel: making a reviewer retype a
        value they have already judged correct manufactures a new defect at the
        exact moment the system is trying to remove one. The seed defect in
        HANDOFF §2 ($202,224 vs $220,224) is that failure.

        This carries no endorsement — every reading gets the same button, in seat
        order. Adopting still requires a reason before it can be recorded.
      */}
      {onAdopt !== undefined && reading.value !== null ? (
        <button
          type="button"
          data-testid={`use-${reading.engine_id}`}
          onClick={() => onAdopt(reading.value ?? "")}
          className="mt-2 rounded-sm border border-line-strong bg-surface-panel px-2 py-1 text-tiny font-semibold text-ink-secondary"
        >
          Use this — the why is still yours
        </button>
      ) : null}

      {/*
        Cost, latency and the engine's self-report — deliberately the quietest
        thing on the card. See the note above: this is context, not a score.
      */}
      <div className="mt-2 flex flex-wrap gap-2 font-mono text-tiny text-ink-muted">
        <span>${reading.cost_usd.toFixed(4)}</span>
        <span>·</span>
        <span>{reading.latency_ms} ms</span>
        {reading.confidence_raw === null ? null : (
          <>
            <span>·</span>
            <span>
              self-rated {reading.confidence_raw.toFixed(2)} — the engine grading
              its own work. Context only; it decides nothing.
            </span>
          </>
        )}
      </div>
    </div>
  );
}
