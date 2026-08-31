import { diffChars } from "diff";
import { cx } from "../../components/ui";

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

export function ReadingText({
  segments,
  className,
}: {
  readonly segments: readonly ReadingSegment[];
  readonly className?: string | undefined;
}) {
  return (
    <span className={cx("font-mono text-body leading-close text-ink-primary", className)}>
      {segments.map((segment, i) => (
        <span
          // Segments are positional and have no identity of their own; the
          // index IS the identity here, and the list is never reordered.
          key={i}
          data-differs={segment.differs}
          // The handle a reviewer's eye has: only the marked run carries it, so
          // "nothing is highlighted" and "everything is" are both a failure.
          data-testid={segment.differs ? "diff-hl" : undefined}
          className={cx(
            segment.differs &&
              "rounded-xs bg-na-unreadable-surface px-1 font-bold text-na-unreadable-ink underline decoration-2",
          )}
        >
          {segment.text}
        </span>
      ))}
    </span>
  );
}
