import type { SourceExcerpt } from "@titlepipe/contract";
import { Button } from "../../components/ui";
import { CitationBox } from "../../entities/evidence/PaperSheet";

/**
 * THE SOURCE EXCERPT, WITH THE MATCH MARKED IN IT.
 *
 * The design draws a bordered strip under the open decision: a header carrying
 * the citation and a "View on page →" door, the quoted line on paper stock with
 * the matched substring boxed, and — when the rulebook has one — an amber note
 * beneath it.
 *
 * THE SPLIT IS THE SERVER'S, and this component is why it had to be. Until
 * `SourceExcerpt` landed the wire carried one flat string, so a reviewer was
 * shown the line and left to find the read inside it. The obvious repair —
 * `snippet.indexOf(value)` here — is the browser deciding what the engine
 * matched, and lands on the wrong occurrence the first time a word appears
 * twice on one line. So `pre`/`hit`/`post` arrive already cut.
 *
 * NOTHING IS RE-CUT, RE-CASED OR ELLIPSISED. The three parts are printed in
 * order, verbatim: an excerpt a reviewer cannot trust to be exactly what the
 * page says is not evidence. `CitationBox` is the same mark the cited line
 * carries on the sheet itself (rule 8's "1.5px accent + 13% fill"), so the
 * highlight here and the highlight there read as one act.
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
        {/* Rule 3: a citation is data, so it is mono. */}
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
       * THE RULEBOOK'S REMARK, when it has one. Amber is the attend family:
       * look at this. Server-authored — a claim about what the document means
       * is not the browser's to compose, so `null` prints nothing at all
       * rather than a stand-in sentence.
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
