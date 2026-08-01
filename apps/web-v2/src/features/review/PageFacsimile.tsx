import type { SourcePage } from "@titlepipe/contract";
import { EvidenceOverlay } from "../../entities/document/EvidenceOverlay";
import type { EvidenceBox } from "../../entities/document/coordinates";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { cn } from "../../shared/ui/classNames";

/**
 * The page, as the package holds it.
 *
 * A DEGRADED PAGE LOOKS DEGRADED. The scan quality is a server finding, and
 * rendering a bad microfilm frame as clean type would quietly tell a reviewer
 * the document is legible when the whole reason the field is queued is that it
 * is not. The treatment is a filter over the text, not a badge beside it —
 * a badge is something you read past.
 *
 * A PAGE NOT READ IN FULL IS NORMAL, NOT AN ERROR. Most pages of a county
 * package carry nothing the report needs, and saying so plainly stops a
 * reviewer hunting for a value on a page no reader ever typed.
 */
export function PageFacsimile({
  page,
  boxes,
}: {
  page: SourcePage;
  boxes: readonly EvidenceBox[] | null;
}) {
  if (!page.read_in_full) {
    return (
      <div className="flex flex-col gap-3 rounded-5 border border-dashed border-line-strong bg-surface-sunken p-8">
        <Eyebrow variant="caption" tone="strong">p{page.n} · not read in full</Eyebrow>
        <p className="text-xs leading-body text-ink-secondary">
          The classifier found nothing here the report needs, so no reader typed
          this page. It is part of the package — it just did not contribute a
          value.
        </p>
      </div>
    );
  }

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex items-baseline gap-4">
        {/*
          THE DOCUMENT INK FAMILY, NOT THE CHROME'S. This caption sits on
          `surface-document`, and since the 2026-08-01 reskin that token holds
          the mockup's viewer surround — a near-black reading room in
          BOTH themes, not the light grey it used to be. Measured on it, the
          chrome inks this line used to carry are 1.31:1 (`ink-primary`) and
          1.68:1 (`ink-secondary`); `state-attend-ink` is 1.89:1. The
          `--color-document-*` family exists for exactly this surround and is
          the only legible vocabulary here. The old note this replaces argued
          `ink-secondary` over `ink-muted` on a 4.33-vs-4.5 margin; the surface
          moved out from under that argument entirely.
        */}
        <Eyebrow variant="caption" tone="strong" className="text-document-ink">
          {page.kind}
        </Eyebrow>
        <span className="font-mono text-tiny text-document-ink-soft">
          page {page.n} of the package
        </span>
        {page.degraded ? (
          <span className="text-tiny font-semibold text-document-attend">
            degraded scan — read against the words line
          </span>
        ) : null}
      </figcaption>

      {/*
        IT READS AS PAPER, because that is what it is. A scanned county record
        rendered as a flush block of terminal text tells a reviewer they are
        looking at data; the whole point of putting the page on screen is that
        they are looking at a DOCUMENT — with margins, a recording stamp and its
        own damage. Serif body, real margins, centred on its surround. The
        design draws it this way and it is not decoration: a reviewer who reads
        the page as data stops checking it against the value.

        THE FACE IS COURIER PRIME, and only here. `--font-document` exists for
        this one element — the mockup's type scale names it "the scanned page
        only" — because what a county package actually holds is typewritten and
        photocopied, and a monospaced typewriter face is the difference between
        a transcript and a facsimile. It replaces `font-quote` (Fraunces), which
        is the app's DISPLAY voice: setting a tax card in the same serif as the
        screen headings quietly claimed the record was typeset by us. The size
        moves 11px → 12px with it, because a mono face at the serif's size reads
        a step smaller than it measures.
      */}
      {/*
        `surface-document` is the BACKDROP the page sits on, not the page — the
        grey of a viewer surround. The sheet is `surface-paper` and its type is
        `page-ink`. Getting these the wrong way round renders the document as a
        grey slab, which is precisely the "this is data, not paper" reading the
        facsimile exists to prevent.

        THE PAGE FAMILY IS PINNED, AND THAT IS WHY IT IS USED HERE. `tokens.css`
        declares `surface-paper`, `page-ink` and their siblings twice with the
        SAME value, under the rule that a scan is a photograph of paper: the
        surround darkens, the page does not. This sheet used to paint itself
        `bg-surface-panel` / `text-ink-primary` — chrome tokens, which invert —
        so under `[data-theme="mocha"]` a scanned county record rendered as a
        dark slab with light type, and the marker over the cited line went
        near-black. The pin had been written, documented and left wired to
        nothing; `entities/document/documentIsPaper.test.ts` now resolves every
        colour utility on this element back to its token and fails if it is one
        the theme can move.
      */}
      {/*
        No second backdrop band: the pane this sits in already carries
        `surface-document`, and painting it again here fenced the page inside a
        box of its own colour. `max-w-230` is the export's ~460px page width —
        at 320px the paper read as a note card floating in a large grey field.
      */}
      <div className="flex justify-center">
        <div className="page-letter relative w-full max-w-230 rounded-2 bg-surface-paper px-12 py-11 shadow-page">
          <pre
            className={cn(
              "font-document text-base leading-document whitespace-pre-wrap text-page-ink",
              page.degraded && "filter-scan-degraded text-scan-ink-degraded",
            )}
          >
            {page.lines.join("\n")}
          </pre>
          <EvidenceOverlay boxes={boxes ?? []} />
        </div>
      </div>
    </figure>
  );
}
