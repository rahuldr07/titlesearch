import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Field, FieldReading } from "@titlepipe/contract";
import { pagesQuery } from "./queries";
import { OrderCoverageSpine } from "./CoverageSpine";
import { PageFacsimile } from "./PageFacsimile";
import { PageNav } from "./PageNav";
import { readingsOf } from "../../entities/field/fieldLabel";
import { toEvidenceBoxes } from "../../entities/document/coordinates";
import { EmptyNote } from "../../shared/ui/EmptyPanel";
import { cn } from "../../shared/ui/classNames";

/** The reading whose line is pinned, if the reviewer picked one. */
function coordsFor(field: Field, pinned: FieldReading | null): unknown {
  if (pinned !== null) return pinned.line_coords;
  return (
    readingsOf(field).find((r) => r.line_coords !== null)?.line_coords ??
    field.source_line_coords
  );
}

/**
 * `grow shrink basis-[52%]` and not `flex-1`: the export declares
 * `flex:1 1 52%` (`:675`) and `flex-1` would hard-set `flex-basis:0`, splitting
 * the frame 50/50. The three longhands cannot collide in the cascade the way a
 * shorthand and a longhand can. A percentage is the one length no design token
 * can encode — it states a relationship to the parent, which is why the rules
 * gate permits `%` where it bans `px`.
 */
const PANE =
  "flex min-h-0 min-w-0 shrink grow basis-[52%] flex-col border-r border-line-strong bg-surface-document";

/** Zoom scales the page, never the chrome around it. */
function zoomClass(zoom: number): string {
  if (zoom > 1.2) return "scale-125";
  if (zoom > 1.05) return "scale-110";
  if (zoom < 0.8) return "scale-75";
  if (zoom < 0.95) return "scale-90";
  return "scale-100";
}

/**
 * THE LEFT PANE — a pinned header, one scroller, and the coverage spine DOCKED
 * at the foot (export `:675-830`).
 *
 * THE SPINE MAY NOT SCROLL AWAY FROM THE PAGES IT DESCRIBES. It sits outside
 * the scroller, on the pane's own footer row, because it answers "where am I in
 * the package" — a question you ask WHILE looking at a page, not one you scroll
 * to the bottom of a column to find. Docking it also makes its cells navigable:
 * the page the facsimile shows is this component's state, so a cell can finally
 * move it, and the export draws those cells as real buttons.
 *
 * THE GREY IS THE BACKDROP, NOT THE PAPER. `surface-document` is what a page
 * SITS ON; `surface-panel` is the sheet. Getting the two the wrong way round
 * renders a scan as a data slab, which is the one reading the facsimile exists
 * to prevent.
 *
 * THE `PAGES READ IN FULL` CHIP STRIP IS GONE (HANDOFF-UI §11). The coverage
 * spine replaced it and the screen kept both, so one pane carried two page maps
 * with different denominators — 6-of-64 beside 64-of-64 — and neither said
 * which was the package.
 *
 * THE PAGE FOLLOWS THE FIELD. Selecting a field moves the viewer to the page it
 * cites, because a reviewer navigating there themselves is the step that gets
 * skipped when the queue is long, and skipping it is how a value gets confirmed
 * without anybody reading the document it came from.
 */
export function DocumentPane({
  orderId,
  field,
  pinned,
}: {
  orderId: string;
  field: Field;
  pinned: FieldReading | null;
}) {
  const { data } = useQuery(pagesQuery(orderId));
  const [override, setOverride] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);

  const cited = pinned?.page ?? field.source_page ?? readingsOf(field)[0]?.page ?? null;
  const current = override ?? cited;
  const pages = data?.pages ?? [];
  const page = pages.find((p) => p.n === current) ?? pages[0];

  if (page === undefined) {
    return (
      <section aria-label="Document" className={PANE}>
        <div className="flex min-h-0 flex-1 items-center justify-center p-12">
          <EmptyNote>No page text is served for this order yet.</EmptyNote>
        </div>
      </section>
    );
  }

  const total = data?.total_pages ?? pages.length;
  const step = (delta: number) => {
    const at = pages.findIndex((p) => p.n === page.n);
    const next = pages[Math.min(Math.max(at + delta, 0), pages.length - 1)];
    if (next) setOverride(next.n);
  };

  return (
    <section aria-label="Document" className={PANE}>
      <div className="flex-none bg-surface-panel">
        <PageNav
          page={page.n}
          totalPages={total}
          zoom={zoom}
          onStep={step}
          onZoom={(next) => setZoom(Math.min(Math.max(next, 0.5), 2))}
        />
      </div>

      {/* `items-start` — a page taller than the frame must start at its top
          edge, not be centred with its head cropped off. */}
      <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto p-12">
        <div className={cn("origin-top", zoomClass(zoom))}>
          <PageFacsimile
            page={page}
            boxes={toEvidenceBoxes(coordsFor(field, pinned), { width: 1, height: 1 })}
          />
        </div>
      </div>

      <OrderCoverageSpine
        orderId={orderId}
        currentPage={page.n}
        onSelect={setOverride}
      />
    </section>
  );
}
