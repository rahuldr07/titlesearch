import type { GoldenField } from "@titlepipe/contract";

/**
 * WHAT THE SEED SAYS, AND WHETHER IT CAN BE CITED.
 *
 * ══ AN UNCITED SEED IS A VISIBLE HARD ERROR ════════════════════════════════
 *
 * `INVARIANTS:8`: "A value with NO PROVENANCE renders as a visible hard error —
 * never a blank, never a bare value." AGENTS.md states it as principle 6,
 * "never emit a value you can't cite", and records that it was caught six times
 * in prototyping.
 *
 * It bites here harder than anywhere else in the product. This corpus is the
 * ruler; an uncited row is a graduation mark nobody can trace to a document,
 * and every score taken against it inherits that. `gf_1` in the live payload is
 * exactly this shape — `$202,224.00`, `source_citation: null`, tag
 * `delivered_report` — and it is the famous case: a typist read a degraded fax,
 * the model read `$220,224`, and §5 words-over-numerals says the SEED is
 * probably the wrong one. Drawn as a bare mono figure it reads as ground truth.
 * Drawn as a defect it reads as the open question it is.
 *
 * So the citation is not an optional caption. Its absence is the render.
 *
 * ══ WHY `readCited` IS NOT USED, AND WHAT IS MISSING BECAUSE OF IT ═════════
 *
 * `shared/provenance.ts` is the classifier for a contract `Field`, which
 * carries `na_reason`, `source_doc_id`, `source_page` and `source_snippet`. A
 * `GoldenField` (entities.ts:188) carries NONE of those. Its provenance is one
 * nullable free-text `source_citation`, and its absence is one nullable
 * `value` with no reason attached.
 *
 * That means the four-state NA taxonomy CANNOT be rendered on this screen — a
 * null seed value cannot say whether the document is silent, unreadable, or
 * simply never searched. Rule 14 ("absence is typed, never a blank") is
 * unsatisfiable against this shape. The gap is stated once on the screen with
 * `ContractGap` rather than papered over here, and what this component does is
 * refuse to print a null as a dash: it says which of the two facts it knows.
 */
export function SeedValue(props: { readonly seed: GoldenField }) {
  const cited = props.seed.source_citation;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {props.seed.value === null ? (
        /*
         * NOT a dash. `INVARIANTS:7` forbids collapsing the absence states and
         * `INVARIANTS:3` forbids deriving anything from `value === null`, so
         * this branch makes exactly one claim — the corpus holds no value here
         * — and explicitly declines to say why, because the shape cannot.
         */
        <span
          data-seed-value="absent"
          className="font-sans text-body leading-close font-semibold text-ink-secondary"
        >
          No value in the corpus
        </span>
      ) : (
        /* Rule 3: a seed value is data — money, a docket type, a name as
           recorded. Mono, at the row's subject size. */
        <span
          data-seed-value="present"
          className="font-mono text-body leading-close font-semibold break-words text-ink-primary"
        >
          {props.seed.value}
        </span>
      )}

      {cited === null ? (
        /*
         * The hard error. `role="alert"` because this is not a caption: it is
         * the statement that a measurement in the ruler cannot be traced, and a
         * reader arriving by keyboard must be told rather than shown.
         */
        <p
          role="alert"
          data-seed-citation="none"
          className="font-sans text-meta leading-body font-semibold text-state-halt"
        >
          {props.seed.value === null
            ? "No citation. Nothing here can be traced to a document — neither the absence nor a reason for it."
            : "Uncited. This value is in the ruler and cannot be traced to a document — never emit a value you can't cite (AGENTS.md, principle 6)."}
        </p>
      ) : (
        /* Rule 3 again: a citation is data. Printed whole, never truncated —
           a page reference with the page cut off is not a page reference. */
        <p
          data-seed-citation="present"
          className="font-mono text-meta leading-body break-words text-ink-muted"
        >
          {cited}
        </p>
      )}
    </div>
  );
}
