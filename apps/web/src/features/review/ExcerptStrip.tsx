import type { SourceExcerpt } from "@titlepipe/contract";
import { Button } from "../../components/ui";
import { CitationBox } from "../../entities/evidence/PaperSheet";

/**
 * The source excerpt, with the match marked in it. The split is the
 * server's: `pre`/`hit`/`post` arrive already cut, because
 * `snippet.indexOf(value)` here would be the browser deciding what the
 * engine matched, and lands on the wrong occurrence the first time a word
 * appears twice on one line. Nothing is re-cut, re-cased or ellipsised —
 * an excerpt a reviewer cannot trust to be exactly what the page says is
 * not evidence. `CitationBox` is the same mark the cited line carries on
 * the sheet, so the two highlights read as one act.
 */
export function ExcerptStrip(props: {
  readonly excerpt: SourceExcerpt;
  /** The door to the sheet. It lives across the split, so the page goes up. */
  readonly onView: (page: number) => void;
}) {
  const excerpt = props.excerpt;

  return (
    <figure
      data-testid="source-excerpt"
      data-excerpt-page={excerpt.page}
      className="overflow-hidden rounded-lg border border-line-strong"
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-4 border-b border-line-strong bg-surface-sunken px-6 py-3">
        {/* A citation is data, so it is mono. */}
        <span className="font-mono text-label leading-flat text-ink-muted">
          Source excerpt · {excerpt.doc_id} p.{excerpt.page}
        </span>
        <Button
          size="sm"
          variant="ghost"
          data-testid="excerpt-view-on-page"
          onPress={() => props.onView(excerpt.page)}
        >
          View on page
        </Button>
      </figcaption>

      {/* Paper stock, serif, scan leading — this is the document speaking. */}
      <blockquote className="bg-surface-paper px-8 py-7 font-serif text-body leading-scan text-page-ink">
        {excerpt.pre}
        <CitationBox>{excerpt.hit}</CitationBox>
        {excerpt.post}
      </blockquote>

      {/*
       * The rulebook's remark, when it has one. Server-authored — a claim
       * about what the document means is not the browser's to compose, so
       * `null` prints nothing at all rather than a stand-in sentence.
       */}
      {excerpt.note !== null && (
        <p
          data-testid="excerpt-note"
          className="border-t border-state-attend-border bg-state-attend-surface px-6 py-4 text-label leading-body text-state-attend"
        >
          {excerpt.note}
        </p>
      )}
    </figure>
  );
}
