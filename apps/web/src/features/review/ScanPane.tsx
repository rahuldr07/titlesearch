import { useRead } from "../../app/useRead";
import { orderPages } from "../../shared/queries";
import { QueryState } from "../../entities/state/QueryState";
import { ScanViewer } from "./ScanViewer";

/**
 * THE SOURCE-PAGE PANE — the workstation's right-hand column.
 *
 * `reference-app.html`'s `isReview` block draws it as: a ground, a Prev / page
 * label / Next row with a zoom control, the sheet (clerk stamp, instrument
 * title, page text, the highlighted hit), a citation note, and — pinned to the
 * bottom of the column — the coverage spine, `Array.from({ length: D.pages })`.
 * That `D.pages` is the whole subject of this pane, and it is why the spine
 * lives here rather than in the field list: it is a property of the PACKAGE.
 *
 * ══ WHAT THE SERVER SERVES, AND WHAT IT DOES NOT ═══════════════════════════
 *
 * `GET /api/orders/{id}/pages` → `{ order_id, total_pages, pages[] }`, and
 * `endpoints.ts:664` is explicit that `pages[]` is TEXT rather than a raster
 * and that `read_in_full: false` is normal. The live fixture makes the trap
 * concrete: `total_pages` is **64** and `pages.length` is **7**. Fifty-seven
 * pages of that package have no entry at all.
 *
 * So `pages` is a SAMPLE, and `pages.length` is not a page count. Every number
 * this pane draws — the spine's cell count, the "p6 / 64" label, the Next
 * bound — comes from `total_pages` (INVARIANT 5: the UI never re-derives
 * counts). The only thing `pages[]` decides is what a given sheet can SAY.
 *
 * ══ THE GROUND ════════════════════════════════════════════════════════════
 *
 * The reference paints this column `#F3F4F7`, one step lighter than the review
 * screen's own `#ECEEF3`. This vocabulary has that value only as
 * `--color-line-faint`, which is a RULE colour — borrowing it for a surface
 * would put a hairline token behind a whole pane and make the next reader
 * wonder which one is authoritative. `bg-surface-app` ("the canvas behind
 * everything") is the token that means what this ground means, so the pane is
 * one step darker than the prototype and honest about which token it spends.
 */
export function ScanPane(props: {
  readonly orderId: string;
  /**
   * The cited page, when a field with provenance is selected. `null` is not an
   * error — it is "no citation selected", and the pane opens on the package's
   * first described page.
   */
  readonly page: number | null;
  /**
   * INVARIANT 33's other half: the cited LINE, as a zero-based index into that
   * page's `lines[]`.
   *
   * CONTRACT GAP: nothing on the wire supplies this yet. `Field.
   * source_line_coords` is `LineCoords`, and `entities.ts:29` declares
   * `LineCoords = z.unknown()` — "exact shape is fixed when the LLMWhisperer
   * adapter lands (P2)". The prop exists because the invariant is a
   * requirement rather than a nice-to-have, and because the alternative —
   * adding it later — is how a pin gets bolted onto a component that was built
   * without room for one. Passed `null`, the pin still marks the PAGE and says
   * in words that no line coordinate was recorded.
   */
  readonly line: number | null;
}) {
  const pages = useRead(orderPages(props.orderId));

  return (
    <section
      aria-label="Source page"
      data-testid="scan-pane"
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
            page={props.page}
            line={props.line}
          />
        )}
      </QueryState>
    </section>
  );
}
