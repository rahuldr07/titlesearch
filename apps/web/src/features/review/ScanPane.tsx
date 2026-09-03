import { useState } from "react";
import type { LineCoords } from "@titlepipe/contract";
import { useRead } from "../../app/useRead";
import { orderPages } from "../../shared/queries";
import { QueryState } from "../../entities/state/QueryState";
import { ScanViewer, type PageRequest } from "./ScanViewer";
import type { ZoomLevel } from "./PageBar";
import { useZoomKey } from "./useReviewKeys";

/**
 * The source-page pane — the workstation's right-hand column: a Prev / page
 * label / Next row with the zoom control and a follow toggle, the sheet,
 * and the coverage spine along the bottom.
 *
 * `Z` is zoom-to-citation: it toggles, `Escape` fits, double-clicking the
 * sheet toggles, and stepping the manual magnifier drops it. A view toggle
 * only — it files nothing and derives nothing, and the scale lands only
 * when the open field's recorded box is on the sheet being shown.
 *
 * Zoom is owned here, not in the viewer, so `Z` can reach it while the
 * pages are still loading and `data-zoomed` sits on a node that is always
 * mounted.
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
   * The cited line, as a zero-based index into that page's `lines[]`.
   * Nothing on the wire supplies an index — `LineCoords` records a
   * position, not an ordinal — so this stays null until a reader emits one.
   */
  readonly line: number | null;
  /** The open field's recorded region. Null = the engine recorded no position. */
  readonly box: LineCoords | null;
  /** A page the decision pane asked to be shown. */
  readonly request: PageRequest | null;
  /**
   * True while the sheet is showing a HOVERED row's citation rather than
   * the open field's. The pin names whose citation it is drawing, so it
   * has to be told when the answer is not "the selected field".
   */
  readonly previewing: boolean;
}) {
  const pages = useRead(orderPages(props.orderId));
  const [zoom, setZoom] = useState<ZoomLevel>("fit");
  /* The drawn zoom-to-citation. A view state, nothing else. */
  const [citeZoom, setCiteZoom] = useState(false);
  /* Whether the sheet follows the open field. On is the design's default
     ("◉ Following"); off lets a reviewer read around the citation without the
     next selection yanking the page away. */
  const [following, setFollowing] = useState(true);

  useZoomKey({
    enabled: true,
    onToggle: () => setCiteZoom((at) => !at),
    onExit: () => setCiteZoom(false),
  });

  return (
    <section
      aria-label="Source page"
      data-testid="evidence-pane"
      data-zoomed={citeZoom ? "1" : "0"}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-viewer"
    >
      {/*
        A failed read renders a named unavailable state and degrades this
        region only — the field list beside it keeps working. `QueryState`
        is that component; this pane does not write its own.
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
            previewing={props.previewing}
            zoom={zoom}
            onZoom={(next) => {
              /* The reference drops the citation zoom when the magnifier is
                 stepped by hand — one magnification statement at a time. */
              setCiteZoom(false);
              setZoom(next);
            }}
            citeZoom={citeZoom}
            onCiteZoom={setCiteZoom}
            following={following}
            onFollowing={setFollowing}
          />
        )}
      </QueryState>
    </section>
  );
}
