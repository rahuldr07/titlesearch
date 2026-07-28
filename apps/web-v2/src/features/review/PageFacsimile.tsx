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
        <Eyebrow variant="caption">p{page.n} · not read in full</Eyebrow>
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
        <Eyebrow variant="caption">{page.kind}</Eyebrow>
        <span className="font-mono text-tiny text-ink-muted">page {page.n} of the package</span>
        {page.degraded ? (
          <span className="text-tiny font-semibold text-state-attend-ink">
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
      */}
      {/*
        `surface-document` is the BACKDROP the page sits on, not the page — the
        grey of a viewer surround. The sheet itself is panel white.
        Getting these the wrong way round renders the document as a grey slab,
        which is precisely the "this is data, not paper" reading the facsimile
        exists to prevent.
      */}
      <div className="flex justify-center bg-surface-document px-8 py-9">
        <div className="relative w-full max-w-160 rounded-2 bg-surface-panel px-12 py-11 shadow-page">
          <pre
            className={cn(
              "font-quote text-sm leading-document whitespace-pre-wrap text-ink-primary",
              page.degraded && "filter-scan-degraded",
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
