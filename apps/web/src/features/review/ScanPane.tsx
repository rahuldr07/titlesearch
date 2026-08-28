import { useRead } from "../../app/useRead";
import { orderPages } from "../../shared/queries";
import { QueryState } from "../../entities/state/QueryState";
import { ScanViewer } from "./ScanViewer";

/**

 * THE SOURCE-PAGE PANE — the workstation's right-hand column. `reference-app.html`'s

 * `isReview` block draws it as: a ground, a Prev / page label / Next row with a zoom

 * control, the sheet (clerk stamp, instrument title, page text, the…

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
   * `lines[]`. CONTRACT GAP: nothing on the wire supplies this yet.
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
