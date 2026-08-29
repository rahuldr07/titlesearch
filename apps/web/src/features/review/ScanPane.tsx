import { useState } from "react";
import type { LineCoords } from "@titlepipe/contract";
import { useRead } from "../../app/useRead";
import { orderPages } from "../../shared/queries";
import { QueryState } from "../../entities/state/QueryState";
import { ScanViewer, type PageRequest } from "./ScanViewer";
import type { ZoomLevel } from "./PageBar";
import { useZoomKey } from "./useReviewKeys";

/**
 * THE SOURCE-PAGE PANE — the workstation's right-hand column.
 * `reference-app.html`'s `isReview` draws a ground, a Prev / page label / Next
 * row with the zoom control and a follow toggle, the sheet, and the coverage
 * spine along the bottom.
 *
 * ZOOM IS OWNED HERE, NOT IN THE VIEWER, so `Z` can reach it. The design binds
 * `Z` to "zoom to the citation" and prints the chord in the top bar; the state
 * has to sit above `QueryState` for the chord to exist while the pages are
 * still loading, and `data-zoomed` has to be on a node that is always mounted.
 * The chord is a VIEW toggle — it files nothing and derives nothing.
 */
export function ScanPane(props: {
  readonly orderId: string;
  /**
   * The cited page, when a field with provenance is selected. `null` is not an error —
   * it is "no citation selected", and the pane opens on the package's first described
   * page.
   */
  readonly page: number | null;
  /**
   * INVARIANT 33's other half: the cited LINE, as a zero-based index into that page's
   * `lines[]`. Still nothing on the wire supplies an INDEX — `LineCoords` records a
   * position, not an ordinal — so this stays null until a reader emits one.
   */
  readonly line: number | null;
  /** The open field's recorded region. Null = the engine recorded no position. */
  readonly box: LineCoords | null;
  /** A page the decision pane asked to be shown. */
  readonly request: PageRequest | null;
}) {
  const pages = useRead(orderPages(props.orderId));
  const [zoom, setZoom] = useState<ZoomLevel>("fit");
  /* Whether the sheet follows the open field. On is the design's default
     ("◉ Following"); off lets a reviewer read around the citation without the
     next selection yanking the page away. */
  const [following, setFollowing] = useState(true);

  /* DECIDED, not an oversight: the reference animates a zoom-to-bbox (scale
     1.85 over 300ms, transform-origin at the citation box) and this build
     simplified it to fit↔200% plus the sheet's scroll-into-view of the cited
     region. A bbox-anchored scale needs an inline transform-origin computed
     from coordinates, which check-rules bans, and 1.85 would be a seventh
     magnification literal beside PageBar's three steps. Revisit only with a
     tokenised mechanism; until then the Z cap describes THIS behaviour. */
  useZoomKey({
    enabled: true,
    onToggle: () => setZoom((at) => (at === "fit" ? "double" : "fit")),
  });

  return (
    <section
      aria-label="Source page"
      data-testid="evidence-pane"
      data-zoomed={zoom === "fit" ? "0" : "1"}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-app"
    >
      {/*
        INVARIANT 58/59: a failed read renders a NAMED unavailable state, and it
        degrades THIS region only — the field list beside it keeps working.
        `QueryState` is that component; this pane does not write its own.
      */}
      <QueryState query={pages} of="this order's source pages">
        {(data) => (
          <ScanViewer
            total={data.total_pages}
            described={data.pages}
            instruments={data.instruments}
            page={props.page}
            line={props.line}
            box={props.box}
            request={props.request}
            zoom={zoom}
            onZoom={setZoom}
            following={following}
            onFollowing={setFollowing}
          />
        )}
      </QueryState>
    </section>
  );
}
