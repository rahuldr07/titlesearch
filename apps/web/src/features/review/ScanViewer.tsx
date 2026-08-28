import { useState } from "react";
import type { SourcePage } from "@titlepipe/contract";
import { ScrollArea } from "../../components/ui";
import { PageBar, type ZoomLevel } from "./PageBar";
import { PageSheet } from "./PageSheet";
import { CoverageSpine } from "./CoverageSpine";

/**
 * THE VIEWER'S STATE, AND THE THREE THINGS IT REFUSES TO COMPUTE.
 *
 * Which page is on screen is a VIEW position — it is not order state, it is
 * not derived from a threshold, and it is not written anywhere. Zoom is the
 * same. Both are local, per §"zoom is a local view control".
 *
 * What is NOT local: how many pages the package has (`total`), whether a page
 * was read in full, and whether a scan is degraded. All three are the server's
 * findings and are printed, never inferred (`endpoints.ts:678` — "never
 * inferred client-side").
 *
 * ══ THE PROP WINS WHEN IT CHANGES; THE READER WINS IN BETWEEN ══════════════
 *
 * A reviewer selecting a cited field must move this pane to the citation
 * (INVARIANT 33). A reviewer then paging away from it must not be yanked back
 * on the next render. That is React's "adjusting state when a prop changes"
 * pattern — compare the prop to the copy stored last render, during render,
 * with no effect and no second paint. An effect here would flash the old page.
 *
 * ══ WHERE IT OPENS ════════════════════════════════════════════════════════
 *
 * With no citation: the package's FIRST DESCRIBED page, not page 1. Page 1 of
 * a county package is a cover the classifier skipped — in the live fixture the
 * first described page is p6 — so opening on p1 would show a correct-but-blank
 * "nobody read this page" sheet every time the workstation loads, and a pane
 * that opens empty reads as broken rather than as honest. Prev still walks
 * down to p1, and the spine covers all 64, so nothing is hidden by this.
 */
export function ScanViewer(props: {
  readonly total: number;
  readonly described: readonly SourcePage[];
  readonly page: number | null;
  readonly line: number | null;
}) {
  const [shown, setShown] = useState(props.page ?? props.described[0]?.n ?? 1);
  const [citedAt, setCitedAt] = useState(props.page);
  const [zoom, setZoom] = useState<ZoomLevel>("fit");

  if (citedAt !== props.page) {
    setCitedAt(props.page);
    if (props.page !== null) setShown(props.page);
  }

  /*
   * CONTRACT GAP, and it is the mocks' own note (`workspace.ts:668`):
   * `total_pages` is a plain int, so a package that could not be read at all
   * arrives as 0. Zero is not "a package of no pages" and it is not a failed
   * request — `QueryState` already answered that one — so it is stated rather
   * than drawn as an empty spine of zero cells.
   */
  if (props.total < 1) {
    return (
      <p className="p-12 text-meta leading-body text-ink-secondary">
        The server reported no page count for this package. That is not a
        package of zero pages — it is the absence of a count, and no source
        page can be shown until one arrives.
      </p>
    );
  }

  const here = props.described.find((page) => page.n === shown) ?? null;
  /* The pin belongs to the CITED page. Paging away from it takes it with you. */
  const pinned = props.page !== null && props.page === shown;

  return (
    <>
      <PageBar
        shown={shown}
        total={props.total}
        zoom={zoom}
        onGo={setShown}
        onZoom={setZoom}
      />
      <ScrollArea label="Source page sheet" axis="both">
        <PageSheet
          n={shown}
          total={props.total}
          page={here}
          zoom={zoom}
          line={pinned ? props.line : null}
          pinned={pinned}
        />
      </ScrollArea>
      <CoverageSpine
        total={props.total}
        described={props.described}
        shown={shown}
        onGo={setShown}
      />
    </>
  );
}
