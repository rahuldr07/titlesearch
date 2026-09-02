import type { FieldReading } from "@titlepipe/contract";
import { Button } from "../../components/ui";
import { ReadingText } from "./readingDiff";
import { segmentsFor } from "./readingSegments";
import { NoValueChip } from "./NoValueChip";

/**
 * Two engines disagreed, and both are attributed. Neither seat is drawn as
 * the default, the winner, or the primary reading — merging is the server's,
 * and preferring one here would be the UI making a ruling. Nothing is sorted
 * by confidence: ordering two readings by a miscalibrated signal is a gate
 * wearing a layout's clothes — the top one gets adopted. `onAdopt` hands the
 * reading up; this component never writes one.
 */
export type ReadingPairProps = {
  readonly a: FieldReading;
  readonly b: FieldReading;
  /** Adopt this reading into the correction editor. Absent = read-only. */
  readonly onAdopt?: ((reading: FieldReading) => void) | undefined;
  /** If adoption is blocked, it is blocked with the server's reason. */
  readonly adoptBlockedBecause?: string | null | undefined;
};

export function ReadingPair({ a, b, onAdopt, adoptBlockedBecause }: ReadingPairProps) {
  /*
   * 🔴 THE TWO SEATS MUST BE TWO ENGINES, AND NOTHING BELOW WORKS OTHERWISE.
   * Both the attribution line and `data-testid={`use-${engine_id}`}` address a
   * seat BY ENGINE — deliberately, so a test adopts a reading rather than a
   * layout position. Hand this one engine twice and both are ambiguous: two
   * identical testids (a strict-mode locator resolves to neither) attributed
   * to the same engine, drawn as if two readers had been consulted. That is
   * reachable payload, not a hypothetical: one value spanning two lines is two
   * readings from one engine (contract entities.ts:25).
   *
   * `nominatedPair` is the gate that guarantees it, and this throw is what
   * makes the guarantee load-bearing rather than a comment — a caller that
   * assembles a pair by hand fails loudly instead of shipping a silent
   * double-attribution.
   */
  if (a.engine_id === b.engine_id) {
    throw new Error(
      `ReadingPair: both seats carry engine "${a.engine_id}". Two readings from ` +
        "one engine are not a comparison — see nominatedPair in features/review/readings.ts.",
    );
  }

  return (
    <div data-reading-pair className="flex flex-col gap-5">
      {a.value !== b.value && <PairRubric />}
      <div className="grid grid-cols-2 gap-6">
        <ReadingSide reading={a} other={b} {...(onAdopt ? { onAdopt } : {})} blocked={adoptBlockedBecause} />
        <ReadingSide reading={b} other={a} {...(onAdopt ? { onAdopt } : {})} blocked={adoptBlockedBecause} />
      </div>
    </div>
  );
}

/**
 * The rubric is a hand-over, not a verdict: it says the seats differ and
 * stops there — no winner, no dimmed side. The second line names what the
 * readings are (drafts, nothing settled), without which a field with no
 * merged value reads as an extraction that returned nothing. Drawn only
 * where the values actually differ.
 */
function PairRubric() {
  return (
    <div className="flex flex-wrap items-baseline gap-5">
      <span className="font-sans text-label font-semibold leading-flat tracking-caps text-state-attend">
        THEY DISAGREE. THAT IS WHY IT IS YOURS.
      </span>
      <span className="font-sans text-meta leading-flat text-ink-muted">
        draft — nothing settled yet
      </span>
    </div>
  );
}

function ReadingSide({
  reading,
  other,
  onAdopt,
  blocked,
}: {
  readonly reading: FieldReading;
  readonly other: FieldReading;
  readonly onAdopt?: ((reading: FieldReading) => void) | undefined;
  readonly blocked: string | null | undefined;
}) {
  return (
    <div
      data-engine-id={reading.engine_id}
      className="flex flex-col gap-4 rounded-md border border-line-strong bg-surface-panel p-6"
    >
      {/* An engine id is data, so mono. */}
      <span className="font-mono text-label leading-flat text-ink-muted">
        {reading.engine_id}
      </span>

      <ReadingValue reading={reading} other={other} />

      {/*
        Not a CitationRef: a FieldReading carries `page` and `snippet` but no
        `source_doc_id`, and Citation requires one. Fabricating a doc id to
        satisfy the type would be inventing provenance, so the page renders
        as a page and claims nothing more.
      */}
      {reading.page !== null && (
        <span className="font-mono text-label leading-flat text-ink-muted">
          p.{reading.page}
          {reading.snippet !== null && (
            <span className="ml-3 text-ink-muted">“{reading.snippet}”</span>
          )}
        </span>
      )}

      {onAdopt !== undefined && (
        <Button
          // Addressed by engine, not by seat: "left" and "right" are a layout,
          // and a test that adopts "the left one" pins the arrangement instead
          // of the reading it meant.
          data-testid={`use-${reading.engine_id}`}
          size="sm"
          variant="secondary"
          disabledBecause={blocked}
          onPress={() => onAdopt(reading)}
        >
          Adopt this reading
        </Button>
      )}
    </div>
  );
}

/**
 * A reading with a null value is not the same absence as a field's: the
 * engine read the page and produced nothing; it did not classify the
 * document. So it borrows the pipeline sentence rather than an NA reason —
 * an engine has no standing to say the instrument is silent.
 */
function ReadingValue({
  reading,
  other,
}: {
  readonly reading: FieldReading;
  readonly other: FieldReading;
}) {
  if (reading.value === null) {
    return <NoValueChip render="not-extracted" sentence="This engine returned nothing" />;
  }
  return <ReadingText segments={segmentsFor(reading.value, other.value ?? "")} />;
}
