import type { BenchResultsResponse } from "@titlepipe/contract";
import { BenchMatrix } from "./BenchMatrix";
import { BenchSectionList } from "./BenchSectionList";

/**
 * THE RUN, ONCE IT HAS ARRIVED: what it was, and its two views of itself.
 *
 * ══ THE IDENTITY STRIP IS FOUR FACTS THE SERVER SENT ═══════════════════════
 *
 * `run_ref` and `seed_version` are identifiers and print in mono (rule 3) —
 * they are what somebody types into a bug report, and a re-cased or prettified
 * identifier stops matching the thing it names. `orders` and `total_fields`
 * are integers the server counted; they are printed, never added to and never
 * divided by. INVARIANT 5: the UI never re-derives a count.
 *
 * `seed_version` sits beside `run_ref` on purpose. A bench result is a claim
 * about a model AND a claim about the seed it was measured against, and the
 * second half is the one that goes missing: `judgments_liens` in this very run
 * carries a `suspect_note` saying the seed is thin and the model may be right.
 * A result with no seed version on the same line is a result nobody can
 * reproduce.
 *
 * ══ TWO PANES, BECAUSE THE PAYLOAD HAS TWO SHAPES ══════════════════════════
 *
 * `cells` is the matrix — section × tag, integers only. `sections` is the same
 * run told as records: each with its own `n`/`passed`, the server's notes, and
 * the individual failures with their citations. They are not two renderings of
 * one array and neither is computed from the other; the server sends both and
 * this screen draws both, side by side, so a number in the grid can be walked
 * across to the field that produced it.
 */
export function BenchResults({ results }: { readonly results: BenchResultsResponse }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-10">
      <dl className="flex flex-wrap items-baseline gap-x-16 gap-y-6">
        <RunFact label="Run" value={results.run_ref} />
        <RunFact label="Golden seed" value={results.seed_version} />
        <RunFact label="Orders in the run" value={String(results.orders)} />
        <RunFact label="Fields measured" value={String(results.total_fields)} />
      </dl>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-12">
        <BenchMatrix cells={results.cells} />
        <BenchSectionList sections={results.sections} />
      </div>
    </div>
  );
}

/**
 * One fact from the run stamp. `dt`/`dd` rather than two spans, because the
 * label and the value are a pair a screen reader should be told is a pair.
 */
function RunFact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <dt className="text-label font-semibold leading-flat text-ink-muted">
        {label}
      </dt>
      {/* Rule 3: a run reference, a seed version and a census count are all
          data. The words beside them are not, and are sans. */}
      <dd className="font-mono text-meta leading-flat font-semibold text-ink-primary">
        {value}
      </dd>
    </div>
  );
}
