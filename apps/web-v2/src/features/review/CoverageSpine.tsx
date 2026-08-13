import { useQuery } from "@tanstack/react-query";
import type { OrderPagesResponse } from "@titlepipe/contract";
import { pagesQuery } from "./queries";
import { PageSpine } from "../../entities/document/PageSpine";
import { coverageCells } from "../../entities/document/pageCoverage";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * Coverage over the whole package, DOCKED at the foot of the document pane.
 *
 * RULE: the summary quotes the SERVER'S page count, and the grid beneath it is
 * drawn by the one component that draws coverage grids. FAILURE PREVENTED: this
 * file used to carry its own copy of the four tiers, their labels, their
 * classifier and their `coverage-cell` testid, identical string for identical
 * string to `entities/document`. Two producers of a testid a release gate counts
 * is a gate that fails on the duplicate instead of on the regression.
 *
 * IT IS A BAR, NOT A CARD. The export draws it as the pane's own footer —
 * `flex:0 0 auto`, panel ground, a single top rule (`:812`) — outside the
 * scroller that holds the page. A card here would float a second bordered box
 * inside a pane that is already a box, and it would scroll away from the pages
 * it describes.
 *
 * THE CELLS NAVIGATE NOW. `onSelect` used to be omitted because the page the
 * facsimile shows was another component's state and a cell that looked
 * clickable would have moved nothing. Docking the spine into that component's
 * pane fixes the wiring, and the export draws these cells as real buttons — the
 * spine is the only way to reach a page nothing cited.
 *
 * The tiers themselves, and why the export's six are refused, are documented
 * once — in `entities/document/pageCoverage.ts` — rather than restated here
 * where the second copy could go stale against the first.
 */
export function CoverageSpine({
  coverage,
  currentPage,
  onSelect,
}: {
  coverage: OrderPagesResponse;
  currentPage?: number | undefined;
  onSelect?: ((n: number) => void) | undefined;
}) {
  return (
    <div
      data-testid="coverage-spine"
      className="flex flex-none flex-col gap-4 border-t border-line-strong bg-surface-panel px-7 py-5"
    >
      {/*
        ONE ELEMENT CARRIES THE WHOLE SENTENCE. It used to be split across an
        eyebrow reading "Coverage" and a paragraph repeating "Coverage · all 64
        pages" directly beneath it — the same word twice, and two nodes a text
        query could both match.
      */}
      <Eyebrow variant="caption">Coverage · all {coverage.total_pages} pages</Eyebrow>
      <PageSpine
        cells={coverageCells(coverage.total_pages, coverage.pages)}
        currentPage={currentPage}
        onSelect={onSelect}
      />
    </div>
  );
}

/**
 * The connected host. Runs the SAME query key `DocumentPane` already fetches
 * (React Query dedupes by key, so this costs no extra request), separately —
 * a partial failure in one region must not blank the other (`errors.spec` #2).
 * Renders nothing until the package's page list resolves, rather than a
 * spine drawn against a stale or zero total.
 */
export function OrderCoverageSpine({
  orderId,
  currentPage,
  onSelect,
}: {
  orderId: string;
  currentPage?: number | undefined;
  onSelect?: ((n: number) => void) | undefined;
}) {
  const { data } = useQuery(pagesQuery(orderId));
  return data ? (
    <CoverageSpine coverage={data} currentPage={currentPage} onSelect={onSelect} />
  ) : null;
}
