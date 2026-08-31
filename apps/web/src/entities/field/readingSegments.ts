import { diffChars } from "diff";

/**
 * The differing characters, and only those. The canonical disagreement is a
 * middle initial, and a word-level diff marks the whole token — a highlight
 * twice the width of the evidence — so the diff is per character. diffChars
 * is a pure string function, not a derivation of state: it decides nothing
 * about which reading is right.
 */
export type ReadingSegment = {
  readonly text: string;
  /** True where this reading differs from the other. Drawn, never scored. */
  readonly differs: boolean;
};

/**
 * One side of the comparison, from ONE reading's point of view. Called twice —
 * once per seat — because the two sides mark different characters and a single
 * shared segment list would have to encode both, which is how a diff renderer
 * ends up highlighting the wrong side.
 */
export function segmentsFor(mine: string, theirs: string): readonly ReadingSegment[] {
  return diffChars(theirs, mine)
    .filter((part) => !part.removed)
    .map((part) => ({ text: part.value, differs: part.added === true }));
}
