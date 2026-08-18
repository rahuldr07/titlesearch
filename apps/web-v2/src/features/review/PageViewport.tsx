import type { SourcePage } from "@titlepipe/contract";
import type { EvidenceBox } from "../../entities/document/coordinates";
import { PageFacsimile } from "./PageFacsimile";
import { cn } from "../../shared/ui/classNames";

/** Zoom scales the page, never the chrome around it. */
function zoomClass(zoom: number): string {
  if (zoom > 1.2) return "scale-125";
  if (zoom > 1.05) return "scale-110";
  if (zoom < 0.8) return "scale-75";
  if (zoom < 0.95) return "scale-90";
  return "scale-100";
}

/**
 * THE SCROLLER THE PAGE SITS IN — the one region of the viewer that moves.
 *
 * `items-start`: a page taller than the frame must start at its TOP edge, not
 * be centred with its head cropped off. The head of a recorded instrument is
 * where the stamp, the book and page, and the instrument number are.
 *
 * ZOOM IS A CLASS, NOT A COMPUTED TRANSFORM. Five steps off the design's own
 * scale, so a zoomed page is still drawn from tokens; `origin-top` keeps the
 * top edge pinned as it grows, for the same reason `items-start` exists.
 *
 * THE OVERLAY IS INSIDE THE TRANSFORM (`PageFacsimile` → `EvidenceOverlay`),
 * positioned in percentages, so the highlight tracks the page at every scale
 * with no arithmetic. An overlay outside it that recomputed pixel offsets from
 * the current zoom is the classic way to get marks that drift off their line.
 */
export function PageViewport({
  page,
  boxes,
  zoom,
  anchorId,
}: {
  page: SourcePage;
  boxes: readonly EvidenceBox[] | null;
  zoom: number;
  anchorId: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto p-12">
      <div className={cn("origin-top", zoomClass(zoom))}>
        <PageFacsimile page={page} boxes={boxes} anchorId={anchorId} />
      </div>
    </div>
  );
}
