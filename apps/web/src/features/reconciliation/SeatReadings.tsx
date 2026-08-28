import type { Reconciliation } from "@titlepipe/contract";
import { ReadingText, segmentsFor } from "../../entities/field/readingDiff";

/**
 * THE TWO SEATS, SIDE BY SIDE, WITH THE DIFFERING CHARACTERS MARKED.
 *
 * `INVARIANTS:30`, an ORPHAN RULE: "the differing characters between two
 * readings are highlighted, so the reviewer sees WHERE they diverge." Written
 * for engine readings; it is the same reader doing the same work here, and on
 * blind-fifty pairs it is if anything sharper — `$4,412.83` against
 * `$4,112.83` is one character, and a senior asked to spot it unaided will
 * eventually not.
 *
 * `segmentsFor` is called ONCE PER SIDE, with the arguments reversed, because
 * the two sides mark different characters; a single shared segment list would
 * have to encode both, which is how a diff renderer highlights the wrong side
 * (`readingDiff.tsx:26-31`).
 *
 * ══ NEITHER SEAT IS THE DEFAULT ════════════════════════════════════════════
 *
 * The mock's own words (handlers.ts:349): "Symmetric A/B — the model is not a
 * party." So A is drawn no differently from B, neither is placed first as the
 * likely answer, and nothing here is sorted or scored. Preferring one would be
 * the UI making the ruling that the citation exists to support.
 *
 * ══ THE SEATS ARE NOT NAMED, BECAUSE THE RECORD DOES NOT NAME THEM ═════════
 *
 * `Reconciliation` (entities.ts:202-213) has `value_a` and `value_b` and no
 * typist beside either. "Seat A" is the wire's own label, not a person invented
 * to sit in it.
 */
export function SeatReadings({ divergence }: { readonly divergence: Reconciliation }) {
  return (
    <div data-reading-pair className="grid grid-cols-2 gap-6">
      <Seat label="Seat A" mine={divergence.value_a} theirs={divergence.value_b} />
      <Seat label="Seat B" mine={divergence.value_b} theirs={divergence.value_a} />
    </div>
  );
}

function Seat({
  label,
  mine,
  theirs,
}: {
  readonly label: string;
  readonly mine: string | null;
  readonly theirs: string | null;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-md border border-line-strong bg-surface-panel p-6">
      <span className="font-sans text-label leading-flat font-bold text-ink-muted">
        {label}
      </span>
      {mine === null ? (
        /*
         * Rule 14 types absence into four members and `NoValueChip` draws them.
         * NOT used: this record carries no `na_reason`, so stamping this seat
         * `NOT_FOUND` would be inventing the reason. Said in the words the
         * record supports — the seat entered nothing — and no further.
         */
        <span className="font-sans text-meta leading-body text-ink-secondary">
          This seat entered no value. The record does not say which absence.
        </span>
      ) : (
        <ReadingText segments={segmentsFor(mine, theirs ?? "")} />
      )}
    </div>
  );
}
