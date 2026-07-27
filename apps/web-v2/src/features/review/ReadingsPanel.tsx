import type { Field, FieldReading } from "@titlepipe/contract";
import { diffChars } from "./diff";
import { enginesDisagree, readingsOf } from "./fieldLabel";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Button } from "../../shared/ui/Button";

const SEAT = ["A", "B", "C", "D"] as const;

function Diffed({ value, against }: { value: string; against: string }) {
  return (
    <span className="font-mono text-base text-ink-primary">
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
 * BOTH READINGS, ATTRIBUTED (`review.spec` #3).
 *
 * When the engines disagree the screen says so in words — "THEY DISAGREE. THAT
 * IS WHY IT IS YOURS." — because the alternative reading of a queued field is
 * "the machine failed", and that is not what happened. Two readers looked at a
 * bad scan and came back with different answers, which is the situation a human
 * exists to settle.
 *
 * A READING CAN BE ADOPTED WITHOUT RETYPING. Typing "$166,097.00" out of one
 * pane and into another is a transcription step, and transcription steps
 * produce exactly the class of defect this screen exists to catch.
 */
export function ReadingsPanel({
  field,
  onPin,
  onAdopt,
}: {
  field: Field;
  onPin: (reading: FieldReading, seat: string) => void;
  onAdopt: (value: string) => void;
}) {
  const readings = readingsOf(field);
  if (readings.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      {enginesDisagree(field) ? (
        <p className="text-xs font-semibold text-state-attend-ink">
          THEY DISAGREE. THAT IS WHY IT IS YOURS.
        </p>
      ) : (
        <p className="text-xs text-ink-muted">
          Both readers agree. This is queued on the region&rsquo;s scan quality,
          not on a disagreement.
        </p>
      )}

      <ul className="flex flex-col gap-4">
        {readings.map((reading, index) => {
          const seat = SEAT[index] ?? String(index + 1);
          const other = readings[index === 0 ? 1 : 0]?.value ?? "";
          return (
            <li
              key={reading.id}
              className="flex flex-col gap-2 rounded-5 border border-line-strong bg-surface-panel p-5"
            >
              <div className="flex flex-wrap items-baseline gap-4">
                <Eyebrow variant="caption">Reader {seat}</Eyebrow>
                <button
                  type="button"
                  onClick={() => onPin(reading, seat)}
                  className="font-mono text-xs text-action underline"
                >
                  {reading.engine_id}
                </button>
              </div>

              {reading.value === null ? (
                <span className="font-mono text-base text-ink-muted">— nothing returned</span>
              ) : (
                <Diffed value={reading.value} against={other} />
              )}

              {reading.snippet === null ? null : (
                <p className="font-quote text-xs italic text-ink-secondary">{reading.snippet}</p>
              )}

              {reading.value === null ? null : (
                <div>
                  <Button
                    size="sm"
                    fill="outlined"
                    tone="neutral"
                    data-testid={`use-${reading.engine_id}`}
                    onClick={() => onAdopt(reading.value ?? "")}
                  >
                    use this reading
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
