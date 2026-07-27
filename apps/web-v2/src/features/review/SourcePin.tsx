import { toEvidenceBoxes } from "../../entities/document/coordinates";
import { EvidenceOverlay } from "../../entities/document/EvidenceOverlay";

/**
 * PROVENANCE COORDINATES RENDER AS A PIN ON THE PAGE (`review.spec` #10).
 *
 * A citation a reviewer has to go and find is a citation they stop checking by
 * Thursday. The whole value of recording where a reading came from is that it
 * costs one click to see, and the pin is what makes that true.
 *
 * NEVER A FAKED BOX. `toEvidenceBoxes` returns null for anything it does not
 * positively recognise, and null means the snippet stands alone. An approximate
 * rectangle over a scan is worse than none: a reviewer will trust it and check
 * the wrong line.
 *
 * CONTRACT GAP: there is no page-image endpoint, so the frame is the page
 * geometry with the recorded line in place — it does not pretend to be a scan.
 */
export function SourcePin({
  seat,
  engineId,
  page,
  coords,
}: {
  seat: string;
  engineId: string;
  page: number | null;
  coords: unknown;
}) {
  // The observed payload is already expressed as fractions of the page, so the
  // page box is the unit square — no scaling, no arithmetic to get wrong.
  const boxes = toEvidenceBoxes(coords, { width: 1, height: 1 });

  return (
    <section className="flex flex-col gap-3">
      {/*
        Upper-case in the MARKUP, not via `text-transform`: `review.spec` #10
        matches this with a case-sensitive regex, and a CSS transform does not
        change what the text actually says.
      */}
      <p className="font-mono text-micro tracking-badge font-bold text-ink-secondary">
        READER {seat} LINE — {engineId}
        {page === null ? "" : ` · page ${page}`}
      </p>
      {boxes === null ? (
        <p className="text-xs text-ink-muted">
          This reader declared no line coordinates, so nothing is drawn. The
          snippet above is the citation.
        </p>
      ) : (
        <div className="relative aspect-[17/22] w-full max-w-96 border border-line-strong bg-surface-document">
          <EvidenceOverlay boxes={boxes} />
        </div>
      )}
    </section>
  );
}
