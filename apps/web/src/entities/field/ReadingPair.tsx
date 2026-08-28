import type { FieldReading } from "@titlepipe/contract";
import { Button } from "../../components/ui";
import { ReadingText, segmentsFor } from "./readingDiff";
import { NoValueChip } from "./NoValueChip";

/**
 * TWO ENGINES DISAGREED, AND BOTH ARE ATTRIBUTED.
 *
 * AGENTS.md: "Engines never see each other's output." The rendering honours the
 * same thing — neither seat is drawn as the default, the winner, or the
 * "primary" reading, because merging is the server's and preferring one here
 * would be the UI making a ruling.
 *
 * NOTHING IS SORTED BY CONFIDENCE. `confidence_raw` is "documented-miscalibrated
 * … never a gate" (`entities.ts:76`), and ordering two readings by it is a gate
 * wearing a layout's clothes: the top one gets adopted.
 *
 * Design §Screens 7: a reading can be "adopted" into the correction editor
 * "without retyping". `onAdopt` hands the reading's VALUE up; this component
 * never writes one.
 */
export type ReadingPairProps = {
  readonly a: FieldReading;
  readonly b: FieldReading;
  /** Adopt this reading into the correction editor. Absent = read-only. */
  readonly onAdopt?: ((reading: FieldReading) => void) | undefined;
  /** Rule 9: if adoption is blocked, it is blocked WITH the server's reason. */
  readonly adoptBlockedBecause?: string | null | undefined;
};

export function ReadingPair({ a, b, onAdopt, adoptBlockedBecause }: ReadingPairProps) {
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
 * THE RUBRIC, AND IT IS A HAND-OVER RATHER THAN A VERDICT.
 *
 * It says the seats differ and stops there — no winner, no dimmed side. The
 * second line names what the two readings ARE: drafts, with nothing settled
 * behind them. Without it a panel whose field carries no merged value reads as
 * an extraction that returned nothing, which is false while two engines are
 * sitting underneath it holding values.
 *
 * Drawn only where the values actually differ: a pair that agrees is not a
 * disagreement, and the sentence would be a lie about the payload.
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
      {/* Rule 3: an engine id is data. Rule 4: the rubric is the only caps. */}
      <span className="font-mono text-label leading-flat text-ink-muted">
        {reading.engine_id}
      </span>

      <ReadingValue reading={reading} other={other} />

      {/*
        NOT a `CitationRef`. A `FieldReading` carries `page` and `snippet` but NO
        `source_doc_id` (`entities.ts:70-81`), and `Citation` requires one —
        "half a citation is not a weaker citation, it is none"
        (`provenance.ts:106-110`). Fabricating a doc id from `engine_id` to
        satisfy the type would be inventing provenance, which is the one thing
        this layer must not do. Reported as a contract gap; the page renders as
        a page and claims nothing more.
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
 * A reading with a null value is NOT the same absence as a field's. The engine
 * read the page and produced nothing; it did not classify the document. So it
 * borrows the pipeline sentence rather than an NA reason — an engine has no
 * standing to say the instrument is silent.
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
