import { cx } from "../../components/ui";
import type { ReadingSegment } from "./readingSegments";

/*
 * The segment vocabulary and the per-character diff live in
 * readingSegments.ts; this file only draws them.
 */
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
