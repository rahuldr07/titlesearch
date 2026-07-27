import { PageChip } from "./PageChip";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Button } from "../../shared/ui/Button";

/**
 * Both engine readings, ATTRIBUTED, neither pre-selected.
 *
 * This is the resolution of conflict C7. The export shows one `current` value
 * and one anonymous `suggested`, which is the confidence-badge inversion in
 * different clothes: an unattributed recommendation the reviewer is invited to
 * accept. CONTEXT §8.3 and `review.spec` #3 require both readings with engine
 * ids, and the contract ships `readings: FieldReading[]`.
 *
 * NEITHER IS PRE-SELECTED, and that is the whole point. The moment one is
 * highlighted as the default, the screen is making a recommendation the backend
 * never made — which is constraint 5. The reviewer picks, or corrects, or
 * escalates.
 *
 * NO CONFIDENCE IS SHOWN (constraint 5, conflict C10). Engine self-report is
 * not evidence and must never read as endorsement.
 *
 * `onAdopt` puts a reading straight into the correction editor — orphan O8's
 * sibling, `ux.spec` #3: "a reading can be adopted without retyping", because
 * re-keying a value a reviewer can already see is a defect source.
 *
 * NOT YET BUILT: per-character diff highlighting between the two readings
 * (`ux.spec` #2). It needs a real diff, and it is a component of its own rather
 * than something to inline here.
 */
export interface Reading {
  /** The engine that produced it. Never anonymous. */
  engineId: string;
  value: string;
  page: number;
}

export function EngineReadings({
  readings,
  onAdopt,
  onViewSource,
}: {
  readings: readonly Reading[];
  onAdopt: (reading: Reading) => void;
  onViewSource?: ((page: number) => void) | undefined;
}) {
  if (readings.length === 0) return null;

  const disagree = new Set(readings.map((r) => r.value)).size > 1;

  return (
    <div className="flex flex-col gap-4">
      <Eyebrow variant="caption" tone={disagree ? "attend" : "muted"}>
        {disagree
          ? "They disagree — that is why it is yours"
          : "Both readings agree"}
      </Eyebrow>

      {readings.map((reading) => (
        <div
          key={reading.engineId}
          className="flex flex-wrap items-center gap-4 rounded-7 border border-line-strong bg-surface-panel px-5 py-4"
        >
          <span className="font-mono text-micro font-bold tracking-badge text-ink-muted uppercase">
            {reading.engineId}
          </span>
          <span className="flex-1 font-mono text-md text-ink-primary">{reading.value}</span>
          <PageChip page={reading.page} onView={onViewSource} />
          <Button size="sm" fill="tinted" tone="action" onClick={() => onAdopt(reading)}>
            Use this
          </Button>
        </div>
      ))}
    </div>
  );
}
