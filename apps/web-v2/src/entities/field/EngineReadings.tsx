import type { Field, FieldReading } from "@titlepipe/contract";
import { diffChars } from "./diff";
import { readingsOf } from "./fieldLabel";
import { Button } from "../../shared/ui/Button";

/** The pin caption's seat letter — see the WHY on `onPin` below. */
const SEAT = ["A", "B", "C", "D"] as const;

function Diffed({ value, against }: { value: string; against: string }) {
  return (
    <span className="font-mono tnum text-base text-ink-primary">
      {diffChars(value, against).map((part, index) =>
        part.differs ? (
          <mark
            key={index}
            data-testid="diff-hl"
            className="bg-state-attend-surface text-state-attend-ink"
          >
            {part.char}
          </mark>
        ) : (
          <span key={index}>{part.char}</span>
        ),
      )}
    </span>
  );
}

/**
 * WHAT EACH ENGINE RETURNED — the body of the fold, never the resting state.
 *
 * This is the half of the old two-card block that survives D4. The half that
 * did not is the framing: a bordered card per engine, each with its own adopt
 * button, presented the ensemble as the decision. The reading itself is stated
 * once above (`AsRead`); this answers the second question — "which of them said
 * what" — for the reviewer who does not believe the first answer.
 *
 * ATTRIBUTED BY ENGINE ID, NEVER BY SEAT. "Reader A" is a position in an array
 * and tells a reviewer nothing they can act on; `llmwhisperer-hq` is a claim
 * about a specific engine with a known failure mode (its zeros-for-Os is what
 * `mortgages.1.lender` is queued on). The seat letter survives in ONE place —
 * the pin caption, where `review.spec` #10 reads "READER B LINE" and where a
 * short ordinal is what makes two pins on one page distinguishable.
 *
 * NEITHER IS PRE-SELECTED, and no confidence is shown. Highlighting one makes a
 * recommendation the server never made; engine self-report is not evidence and
 * must never read as endorsement.
 *
 * THE DIFFERING CHARACTERS ARE MARKED (`ux.spec` #2). "SOUTHSTONE" against
 * "S0UTHST0NE" is three substitutions in twenty-three characters, and a
 * reviewer comparing them by eye at speed will pass it.
 *
 * A READING IS ADOPTED, NEVER RETYPED (`ux.spec` #3). Transcribing a value out
 * of one pane and into another produces exactly the class of defect this screen
 * exists to catch.
 */
export function EngineReadings({
  field,
  onAdopt,
  onPin,
}: {
  field: Field;
  onAdopt: (value: string) => void;
  /** Draws the reading's recorded line on the page. Seat names the pin. */
  onPin: (reading: FieldReading, seat: string) => void;
}) {
  const readings = readingsOf(field);
  if (readings.length === 0) return null;

  return (
    <ul className="flex flex-col gap-3">
      {readings.map((reading, index) => {
        const seat = SEAT[index] ?? String(index + 1);
        const other = readings[index === 0 ? 1 : 0]?.value ?? "";
        return (
          <li key={reading.id} className="flex flex-wrap items-baseline gap-4">
            <button
              type="button"
              onClick={() => onPin(reading, seat)}
              className="font-mono text-micro font-bold tracking-badge text-action underline"
            >
              {reading.engine_id}
            </button>

            {reading.value === null ? (
              <span className="font-mono text-base text-ink-muted">
                — nothing returned
              </span>
            ) : (
              <Diffed value={reading.value} against={other} />
            )}

            {reading.page === null ? null : (
              <span className="font-mono tnum text-micro font-semibold text-page-ref">
                p{reading.page}
              </span>
            )}

            {reading.value === null ? null : (
              <Button
                size="sm"
                fill="tinted"
                tone="action"
                data-testid={`use-${reading.engine_id}`}
                onClick={() => onAdopt(reading.value ?? "")}
              >
                Correct to this
              </Button>
            )}

            {reading.snippet === null ? null : (
              <p className="w-full font-quote text-xs italic text-ink-secondary">
                {reading.snippet}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
