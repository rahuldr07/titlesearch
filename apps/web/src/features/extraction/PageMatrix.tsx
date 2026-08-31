import { useNavigate } from "@tanstack/react-router";
import type { SourcePage } from "@titlepipe/contract";
import { cx } from "../../components/ui";
import { LEGEND, PAINT, cellLabel, stateOf } from "./pageCell";

/**
 * One cell per package page, not just read ones: the denominator is the
 * server's `total_pages`, never `pages.length` — the array is a sample, and
 * mapping it would tell a reviewer the whole package was covered while most of
 * it was never read. A page with no entry gets a cell saying nobody read it.
 *
 * The undersized targets are deliberate (WCAG 2.2 §2.5.8 essential-presentation
 * exemption — 181 cells at 24px is not a matrix); every cell carries a `title`
 * and `aria-label`, so colour is never the only carrier.
 *
 * Selection is URL-owned: a cell navigates to the workstation with `page` in
 * the search string. The design's "Auto-scaling (10k+ pages)" caption is
 * absent — a capacity claim no response carries.
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
                    to: "/orders/$orderId/review",
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
