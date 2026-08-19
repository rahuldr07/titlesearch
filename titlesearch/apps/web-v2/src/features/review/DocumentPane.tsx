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
  return readingsOf(field).find((r) => r.line_coords !== null)?.line_coords ?? field.source_line_coords;
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
  "flex min-h-0 min-w-0 shrink grow basis-[26%] flex-col border-l border-[#DDDDD8] bg-[#F7F7F5]";

/** Zoom scales the page, never the chrome around it. */
function zoomClass(zoom: number): string {
  if (zoom > 1.2) return "scale-125";
  if (zoom > 1.05) return "scale-110";
  if (zoom < 0.8) return "scale-75";
  if (zoom < 0.95) return "scale-90";
  return "scale-100";
}


import { SectionRail } from "./SectionRail";

export function DocumentPane({
  orderId,
  field,
  fields,
  pinned,
}: {
  orderId: string;
  field: Field;
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
      <div className="flex-none bg-[#F7F7F5]">
        <PageNav
          page={page.n}
          totalPages={total}
          zoom={zoom}
          onStep={step}
          onZoom={(next) => setZoom(Math.min(Math.max(next, 0.5), 2))}
        />
      </div>

      <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto p-12">
        <div className={cn("origin-top shadow-lg", zoomClass(zoom))}>
          <PageFacsimile
            page={page}
            boxes={toEvidenceBoxes(coordsFor(field, pinned), { width: 1, height: 1 })}
          />
        </div>
      </div>

      <div className="flex-none bg-[#F7F7F5] pt-4 pb-8 px-12 border-t border-[#DDDDD8]">
        <SectionRail fields={fields} selectedPath={field.path} />
      </div>
    </section>
  );
}
