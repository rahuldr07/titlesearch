/**
 * Character-level diff between two engine readings.
 *
 * Why this exists: the errors that matter here are one or two characters deep.
 * `SOUTHSTONE` vs `S0UTHST0NE` (OCR zeros for letter O), `$202,224` vs
 * `$220,224` (transposed digits), `MARIA L.` vs `MARIA I.` A reviewer comparing
 * two similar strings by eye is doing the one task humans are measurably bad at,
 * and the real seed defect in HANDOFF §2 is exactly that failure.
 *
 * Highlighting the divergence is orphan rule O12 — it exists in no document,
 * only in the harvested `ux.spec` "differing characters between readings are
 * highlighted".
 *
 * Pure and node-testable on purpose: the alignment is the part that can be
 * subtly wrong, and it must be provable without a DOM.
 */

export interface DiffSeg {
  readonly text: string;
  /** false = this run differs from the other reading and must be marked */
  readonly same: boolean;
}

/** Longest common subsequence table. Readings are short; O(n·m) is fine. */
function lcsTable(a: string, b: string): number[][] {
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      const row = table[i];
      const next = table[i + 1];
      if (row === undefined || next === undefined) continue;
      row[j] =
        a[i] === b[j]
          ? (next[j + 1] ?? 0) + 1
          : Math.max(next[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  return table;
}

function coalesce(marks: readonly { ch: string; same: boolean }[]): DiffSeg[] {
  const out: DiffSeg[] = [];
  for (const m of marks) {
    const last = out[out.length - 1];
    if (last !== undefined && last.same === m.same) {
      out[out.length - 1] = { text: last.text + m.ch, same: last.same };
    } else {
      out.push({ text: m.ch, same: m.same });
    }
  }
  return out;
}

/**
 * Aligns the two strings and marks the runs that are NOT shared. Insertions and
 * deletions align correctly — a naive index-by-index compare would flag every
 * character after a single inserted one, which is worse than no highlight at all
 * because it hides the real difference in noise.
 */
export function diffChars(
  a: string,
  b: string,
): { readonly a: DiffSeg[]; readonly b: DiffSeg[] } {
  const table = lcsTable(a, b);
  const aMarks: { ch: string; same: boolean }[] = [];
  const bMarks: { ch: string; same: boolean }[] = [];

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const ca = a[i];
    const cb = b[j];
    if (ca === cb && ca !== undefined) {
      aMarks.push({ ch: ca, same: true });
      bMarks.push({ ch: ca, same: true });
      i++;
      j++;
      continue;
    }
    // walk whichever side the LCS says to drop
    const down = table[i + 1]?.[j] ?? 0;
    const right = table[i]?.[j + 1] ?? 0;
    if (down >= right) {
      if (ca !== undefined) aMarks.push({ ch: ca, same: false });
      i++;
    } else {
      if (cb !== undefined) bMarks.push({ ch: cb, same: false });
      j++;
    }
  }
  for (; i < a.length; i++) {
    const ca = a[i];
    if (ca !== undefined) aMarks.push({ ch: ca, same: false });
  }
  for (; j < b.length; j++) {
    const cb = b[j];
    if (cb !== undefined) bMarks.push({ ch: cb, same: false });
  }

  return { a: coalesce(aMarks), b: coalesce(bMarks) };
}

/** True when the two readings are not character-identical. */
export function readingsDiffer(values: readonly (string | null)[]): boolean {
  const present = values.filter((v): v is string => v !== null);
  return new Set(present).size > 1;
}
