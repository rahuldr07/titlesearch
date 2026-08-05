import { PageChip } from "./PageChip";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Card, CardBody } from "../../shared/ui/Card";

/**
 * Where a value came from: source document, page, the exact snippet, and
 * whether coordinates were declared.
 *
 * BRIEF §8 makes all four part of provenance. The fourth is the one usually
 * forgotten: an engine that declared no coordinates is not the same as one that
 * did, and saying so is what stops a reviewer wondering why no highlight
 * appeared and assuming the pane is broken.
 *
 * The snippet is quoted VERBATIM and never paraphrased or truncated in the
 * middle — it is the citation of record, and a shortened citation is a
 * different claim. Serif because the design reserves it for quoted text.
 */
export function ProvenancePanel({
  documentName,
  page,
  snippet,
  hasCoordinates,
  onViewSource,
}: {
  /** The source document as the server names it. */
  documentName: string;
  page: number;
  /** Exact text the value was read from. */
  snippet: string;
  hasCoordinates: boolean;
  onViewSource?: ((page: number) => void) | undefined;
}) {
  return (
    <Card size="nested">
      <CardBody>
        <div className="flex flex-wrap items-baseline gap-4">
          <Eyebrow variant="caption">Source</Eyebrow>
          <span className="text-base text-ink-primary">{documentName}</span>
          <PageChip page={page} onView={onViewSource} />
        </div>

        <blockquote className="mt-4 border-l-(length:--stroke-accent) border-line-strong pl-5 font-quote text-base leading-body text-ink-secondary">
          {snippet}
        </blockquote>

        {!hasCoordinates ? (
          <p className="mt-4 text-xs text-state-attend-ink">
            This engine declared no coordinates, so there is no highlight on the
            page. The quoted text above is the citation.
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
