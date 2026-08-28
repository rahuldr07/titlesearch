import type { BenchFailRow } from "@titlepipe/contract";

/**
 * ONE MISSED FIELD: what the model read, what the seed holds, and the note that
 * says which of the two is wrong.
 *
 * ══ THE MODEL'S READING DOES NOT LOSE BY DEFAULT ═══════════════════════════
 *
 * A bench "failure" is a DISAGREEMENT with the seed, not proof the model erred.
 * Two of this run's rows say so outright — "the model may be right and the seed
 * wrong" — and the `suspect` tag exists for exactly that case. So the two
 * readings are drawn as a pair, at the same size and weight, with neutral
 * labels naming their sources. Striking one through or tinting it red would be
 * this screen ruling on a question it has no standing to rule on, and the
 * ruling belongs to a senior on the reconciliation screen.
 *
 * ══ THE NOTE IS THE CITATION AND IT IS NEVER CLIPPED ═══════════════════════
 *
 * `source_note` is where the run says WHY, with a page reference or a rule
 * number. It wraps. See `BenchSectionList` for why this is not a table row.
 *
 * ══ `golden_field_id` IS PRINTED, NOT LINKED ═══════════════════════════════
 *
 * `endpoints.ts:355` calls it a "link into seed correction when the seed itself
 * is investigable", and its presence is the server saying this seed value can
 * be challenged. The seed-correction screen is not built
 * (`app/chrome/unbuiltScreens.ts:85`), so there is no route to link to and a
 * link to nowhere is worse than an identifier: the id is what a correction is
 * filed against, and printing it in mono is the honest half of the affordance.
 * When that screen lands this becomes an anchor and nothing else changes.
 */
export function BenchFail({ fail }: { readonly fail: BenchFailRow }) {
  return (
    <div className="flex flex-col gap-5 border-l-2 border-line-strong pl-8">
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <span className="font-mono text-meta leading-close font-semibold text-ink-primary">
          {fail.path}
        </span>
        <span className="font-mono text-label leading-flat text-ink-muted">
          {fail.tag}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <Reading label="The model read" value={fail.model_value} />
        <Reading label="The golden seed holds" value={fail.seed_value} />
      </div>

      {fail.source_note !== null && (
        <p className="text-meta leading-body text-ink-secondary">{fail.source_note}</p>
      )}

      {fail.golden_field_id !== null && (
        <p className="text-label leading-close text-ink-muted">
          The seed itself is investigable — golden field{" "}
          <span className="font-mono text-label text-ink-secondary">
            {fail.golden_field_id}
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * One side of the disagreement. `null` is not a blank (rule 14): the row's
 * value is nullable and a missing one is stated in words. It is NOT typed into
 * the four-state NA taxonomy, because `BenchFailRow` carries no `na_reason` —
 * saying "not present in the package" here would be the client inventing a
 * provenance the run never sent.
 */
function Reading({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-label font-semibold leading-flat text-ink-muted">
        {label}
      </span>
      {value === null ? (
        <span className="text-meta leading-close text-ink-faint">
          The run recorded no value on this side.
        </span>
      ) : (
        <span className="font-mono text-meta leading-close break-words text-ink-primary">
          {value}
        </span>
      )}
    </div>
  );
}
