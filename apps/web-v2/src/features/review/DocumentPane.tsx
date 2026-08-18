import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Field, FieldReading } from "@titlepipe/contract";
import { pagesQuery } from "./queries";
import { OrderCoverageSpine } from "./CoverageSpine";
import { SectionRail } from "./SectionRail";
import { PageNav } from "./PageNav";
import { PageViewport } from "./PageViewport";
import { readingsOf } from "../../entities/field/fieldLabel";
import { toEvidenceBoxes } from "../../entities/document/coordinates";
import { EmptyNote } from "../../shared/ui/EmptyPanel";

/**
 * The one element that IS the cited line, named so the draft's tie line can
 * find it. Exported rather than spelled twice in two panes — a tie line that
 * draws nothing looks identical to a field with no coordinates, so a typo in
 * the second literal would be invisible.
 */
export const EVIDENCE_ANCHOR_ID = "evidence-anchor";

/** The reading whose line is pinned, if the reviewer picked one. */
function coordsFor(field: Field, pinned: FieldReading | null): unknown {
  if (pinned !== null) return pinned.line_coords;
  return (
    readingsOf(field).find((r) => r.line_coords !== null)?.line_coords ??
    field.source_line_coords
  );
}

/**
 * `grow shrink basis-[38%]` and not `flex-1`, which would hard-set
 * `flex-basis:0` and split the frame evenly. A percentage is the one length no
 * token can encode — it states a relationship to the parent, which is why the
 * rules gate permits `%` where it bans `px`.
 *
 * THE DOCUMENT IS THE REFERENCE COLUMN NOW. The export declares `flex:1 1 52%`
 * (`:675`) with the viewer leading; this screen leads with the draft, so the
 * split is 62/38 the other way, and the rule moves to `border-l` with it. 38%
 * IS A FLOOR CHOSEN FOR THE PAGE, not for the mockup: below roughly a third of
 * a laptop frame a facsimile stops being readable as a scan, which is the one
 * thing this pane exists for. The reskin drew 26%; at that width a county deed
 * is a grey ribbon.
 */
const PANE =
  "flex min-h-0 min-w-0 shrink grow basis-[38%] flex-col border-l border-line-strong bg-surface-document";

/**
 * THE LEFT PANE — a pinned header, one scroller, and the coverage spine DOCKED
 * at the foot (export `:675-830`).
 *
 * THE SPINE MAY NOT SCROLL AWAY FROM THE PAGES IT DESCRIBES — it is outside the
 * scroller, on the footer row, because it answers "where am I in the package",
 * asked WHILE looking at a page. Docking it also makes its cells navigable: the
 * displayed page is this component's state, so a cell can move it.
 *
 * THE GREY IS THE BACKDROP, NOT THE PAPER. `surface-document` is what a page
 * SITS ON; `surface-panel` is the sheet. The wrong way round renders a scan as
 * a data slab, which is the one reading the facsimile exists to prevent.
 *
 * THE `PAGES READ IN FULL` CHIP STRIP IS GONE (HANDOFF-UI §11) — the pane
 * carried two page maps with different denominators, 6-of-64 beside 64-of-64,
 * and neither said which was the package.
 *
 * THE PAGE FOLLOWS THE FIELD — navigating there yourself is the step that gets
 * skipped when the queue is long, and skipping it is how a value gets confirmed
 * without anybody reading the document it came from.
 *
 * TWO THINGS DOCK AT THE FOOT, answering two halves of one question:
 * `SectionRail` says WHICH INSTRUMENT is on which page, `OrderCoverageSpine`
 * says WHICH PAGES anybody read. Both are package maps read WHILE looking at a
 * page — the same argument that docked the spine here. The rail is capped and
 * scrolls internally so a twelve-section order cannot push the facsimile out.
 */
export function DocumentPane({
  orderId,
  field,
  fields,
  pinned,
}: {
  orderId: string;
  field: Field;
  /** Every field on the order — the docked rail's sections, not the viewer's. */
  fields: readonly Field[];
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

      <PageViewport
        page={page}
        boxes={toEvidenceBoxes(coordsFor(field, pinned), { width: 1, height: 1 })}
        zoom={zoom}
        anchorId={EVIDENCE_ANCHOR_ID}
      />

      <SectionRail fields={fields} selectedPath={field.path} />

      <OrderCoverageSpine
        orderId={orderId}
        currentPage={page.n}
        onSelect={setOverride}
      />
    </section>
  );
}
