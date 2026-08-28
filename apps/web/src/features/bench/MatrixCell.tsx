import type { BenchCell } from "@titlepipe/contract";

/** One row of the matrix: a section, and whichever tags the run has cells for. */
export type MatrixRow = {
  readonly section: string;
  readonly byTag: Map<string, BenchCell>;
};

/**
 * ONE CELL OF THE MATRIX, AND THE TWO THINGS AN EMPTY ONE IS NOT.
 *
 * A missing cell is NOT a zero and NOT a failure. `vesting_deed` has no
 * `suspect` cell in this run because no field in that section carries a suspect
 * seed — there was nothing to pass or fail. Drawing `0 / 0` would put a
 * denominator of nothing on the screen and invite the reader to average it;
 * drawing a blank would look like a rendering bug. Design rule 14 is the rule:
 * "absence is typed, never a blank", and the type here is "no fields carry this
 * tag in this section".
 *
 * ══ THE NUMBERS ARE READ ALOUD AS A SENTENCE ═══════════════════════════════
 *
 * "64 / 66" is announced by a screen reader as "sixty-four slash sixty-six",
 * which is not what it means. The glyph pair is `aria-hidden` and the
 * `sr-only` sentence carries the meaning, so both readers get the same fact.
 *
 * `passed` and `fields` are printed side by side and never reduced. See
 * `BenchMatrix` for why there is no ratio anywhere in this directory.
 */
export function MatrixCell({ cell }: { readonly cell: BenchCell | undefined }) {
  if (cell === undefined) {
    return (
      <span className="text-meta leading-close text-ink-disabled">
        <span aria-hidden>—</span>
        <span className="sr-only">No fields carry this tag in this section.</span>
      </span>
    );
  }

  return (
    <span className="flex items-baseline gap-2">
      <span
        aria-hidden
        className="font-mono text-meta leading-close font-semibold text-ink-primary"
      >
        {cell.passed}
      </span>
      <span aria-hidden className="font-mono text-meta leading-close text-ink-faint">
        /
      </span>
      <span aria-hidden className="font-mono text-meta leading-close text-ink-secondary">
        {cell.fields}
      </span>
      <span className="sr-only">
        {cell.passed} passed of {cell.fields} fields
      </span>
    </span>
  );
}
