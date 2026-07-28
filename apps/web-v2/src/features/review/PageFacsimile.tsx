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

      <div className="relative overflow-hidden rounded-4 border border-line-strong bg-surface-document p-8">
        <pre
          className={cn(
            "font-mono text-xs leading-document whitespace-pre-wrap text-ink-primary",
            page.degraded && "filter-scan-degraded",
          )}
        >
          {page.lines.join("\n")}
        </pre>
        <EvidenceOverlay boxes={boxes ?? []} />
      </div>
    </figure>
  );
}
