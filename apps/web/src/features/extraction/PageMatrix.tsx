import { useNavigate } from "@tanstack/react-router";
import type { SourcePage } from "@titlepipe/contract";
import { cx } from "../../components/ui";
import { LEGEND, PAINT, cellLabel, stateOf } from "./pageCell";

/**
 * THE PAGE MATRIX — the design's "high-density raster scan matrix": a wrapped
 * field of 12x18 blocks, a legend on the title row, a hint line under a
 * hairline.
 *
 * INVARIANT 34: ONE CELL PER PACKAGE PAGE, NOT JUST READ ONES. The denominator
 * is `OrderPagesResponse.total_pages` — the server's count — and NEVER
 * `pages.length`. The live fixture makes that failure loud: `total_pages` is 64
 * and the array holds 7. Mapping the array draws seven cells and tells a
 * reviewer the search covered the whole package while fifty-seven pages of it
 * were never read by anybody. A page with no entry gets a cell in the sunken
 * paint and a title saying nobody read it (`pageCell.ts`).
 *
 * WCAG 2.2 §2.5.8 exempts an undersized target where the presentation is
 * ESSENTIAL, and this is that case: PRODUCT.md puts a real package at 36-181
 * pages, and 181 cells at 24px is a 4,344px row, which is not a matrix. Every
 * cell carries a `title` and an `aria-label` naming its page and what happened
 * to it, so the colour is never the only carrier. Same finding as
 * `CoverageSpine`.
 *
 * INVARIANT 55: selection is URL-owned, so a cell navigates to the frozen door
 * `/orders/$orderId` with `page` in the search string beside `field`.
 *
 * REFUSED FROM THE DESIGN: its footer caption "Auto-scaling (10k+ pages)" — a
 * claim about system capacity that no response carries.
 */
export function PageMatrix(props: {
  readonly orderId: string;
  readonly total: number;
  readonly pages: readonly SourcePage[];
}) {
  const navigate = useNavigate();
  const byPage = new Map(props.pages.map((page) => [page.n, page]));

  if (props.total === 0) {
    return (
      <p
        data-testid="page-matrix-empty"
        className="font-sans text-meta leading-body text-ink-secondary"
      >
        The server counted no pages in this package. That is the count it
        served, not a page list this screen failed to read.
      </p>
    );
  }

  return (
    <>
      <ul
        data-testid="page-matrix"
        aria-label={`Package coverage — every page of ${props.total}`}
        className="flex flex-wrap gap-1"
      >
        {Array.from({ length: props.total }, (_, index) => {
          const n = index + 1;
          const page = byPage.get(n);
          const label = cellLabel(n, page);
          return (
            <li key={n}>
              <button
                type="button"
                data-testid={`page-cell-${n}`}
                data-degraded={page?.degraded === true ? "true" : undefined}
                data-read={page === undefined ? "none" : String(page.read_in_full)}
                title={label}
                aria-label={label}
                onClick={() =>
                  void navigate({
                    to: "/orders/$orderId",
                    params: { orderId: props.orderId },
                    search: { page: n },
                  })
                }
                className={cx(
                  "tp-state tp-ring block h-9 w-6 cursor-pointer rounded-paper border",
                  PAINT[stateOf(page)],
                )}
              />
            </li>
          );
        })}
      </ul>
      <p className="mt-8 border-t border-line-subtle pt-8 font-sans text-label leading-body text-ink-muted">
        One block per page of the package the server counted. Hover a block to
        read what happened to that page; choosing one opens the workstation
        there.
      </p>
    </>
  );
}

/** The design's legend, on the matrix card's title row. */
export function PageMatrixLegend() {
  return (
    <span className="flex flex-wrap items-center gap-6">
      {LEGEND.map((entry) => (
        <span
          key={entry.state}
          className="flex items-center gap-3 font-sans text-label leading-flat font-semibold text-ink-muted"
        >
          <span
            aria-hidden
            className={cx("block h-5 w-5 rounded-paper border", PAINT[entry.state])}
          />
          {entry.label}
        </span>
      ))}
    </span>
  );
}
