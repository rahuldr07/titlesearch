import { Eyebrow } from "../../shared/ui/Eyebrow";
import { cn } from "../../shared/ui/classNames";

/**
 * The citation of record, always rendered as TEXT.
 *
 * This is not a caption for the highlight — it is the primary evidence. When an
 * engine declares no coordinates there is no overlay at all, and this is the
 * only thing shown, which is correct: a box drawn where we guess the line might
 * be is worse than no box, because a reviewer will trust it (`leaderboard.spec`
 * #2, declared-not-faked).
 *
 * It also carries the citation for screen-reader users, who get nothing from a
 * highlight. The label says explicitly when coordinates are absent rather than
 * leaving the reader to infer it from a missing rectangle they cannot see.
 *
 * Serif is semantic here — the design reserves it for human-authored and
 * quoted text, never machine output, and this is quoted from the document.
 */
export function CitedText({
  snippet,
  hasCoordinates,
  dark = false,
}: {
  snippet: string;
  hasCoordinates: boolean;
  dark?: boolean;
}) {
  return (
    <figure
      className={cn(
        "border-t px-6 py-5",
        dark
          ? "border-document-line bg-document-card"
          : "border-line-strong bg-surface-panel",
      )}
    >
      <Eyebrow variant="caption" tone={hasCoordinates ? "muted" : "attend"}>
        {hasCoordinates ? "Cited text" : "Cited text — no coordinates declared"}
      </Eyebrow>
      <blockquote
        className={cn(
          "mt-2 font-quote text-base",
          dark ? "text-document-ink-soft" : "text-ink-secondary",
        )}
      >
        {snippet}
      </blockquote>
    </figure>
  );
}
