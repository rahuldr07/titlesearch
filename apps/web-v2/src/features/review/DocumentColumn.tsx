import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Field, FieldReading } from "@titlepipe/contract";
import { pagesQuery } from "./queries";
import { PageFacsimile } from "./PageFacsimile";
import { readingsOf } from "./fieldLabel";
import { toEvidenceBoxes } from "../../entities/document/coordinates";
import { PageStrip } from "../../entities/document/PageStrip";
import { Card, CardBody } from "../../shared/ui/Card";

/** The reading whose line is pinned, if the reviewer picked one. */
function coordsFor(field: Field, pinned: FieldReading | null): unknown {
  if (pinned !== null) return pinned.line_coords;
  return readingsOf(field).find((r) => r.line_coords !== null)?.line_coords ?? field.source_line_coords;
}

/**
 * The document, beside the decision.
 *
 * THE PAGE FOLLOWS THE FIELD. Selecting a field moves the viewer to the page
 * that field cites, because the alternative — a reviewer navigating to the page
 * themselves — is the step that gets skipped when the queue is long, and
 * skipping it is how a value gets confirmed without anybody reading the
 * document it came from.
 *
 * THE STRIP SHOWS PAGES READ IN FULL AGAINST THE PACKAGE TOTAL. Eleven of
 * sixty-four is not a gap: most pages of a county package carry no field the
 * report needs. Showing both numbers stops that reading as missing work.
 */
export function DocumentColumn({
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

  const cited = pinned?.page ?? field.source_page ?? readingsOf(field)[0]?.page ?? null;
  const current = override ?? cited;
  const pages = data?.pages ?? [];
  const page = pages.find((p) => p.n === current) ?? pages[0];

  if (page === undefined) {
    return (
      <Card>
        <CardBody>
          <p className="text-xs text-ink-muted">
            No page text is served for this order yet.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-6">
        <PageFacsimile
          page={page}
          boxes={toEvidenceBoxes(coordsFor(field, pinned), { width: 1, height: 1 })}
        />
        <PageStrip
          pages={pages.filter((p) => p.read_in_full).map((p) => p.n)}
          totalPages={data?.total_pages ?? pages.length}
          currentPage={page.n}
          onSelect={setOverride}
        />
      </CardBody>
    </Card>
  );
}
