import { useNavigate } from "@tanstack/react-router";
import type { SourcePage } from "@titlepipe/contract";
import { cx } from "../../components/ui";
import { LEGEND, PAINT, describe, stateOf } from "./pageCell";

/**
 * THE PAGE MATRIX — the design's "high-density raster scan matrix"
 * (`/tmp/ref.html` §isProcessing): a wrapped field of 12x18 blocks, a legend
 * on the title row, and a hint line under a hairline.
 *
 * ══ INVARIANT 34: ONE CELL PER PACKAGE PAGE, NOT JUST READ ONES ════════════
 *
 * The denominator is `OrderPagesResponse.total_pages` — the server's count.
 * It is NEVER `pages.length`, and the live fixture is built to make that
 * failure loud: `total_pages` is 64 and the array holds 7. This component used
 * to map the array, so it drew seven cells and quietly claimed the package was
 * seven pages long. That is not a cosmetic bug: it told a reviewer the search
 * covered the whole package when fifty-seven pages of it were never read by
 * anybody. The reference app agrees — its own loop is `for (n = 1; n <= pages)`.
 *
 * A page with no entry in `pages[]` gets a cell in the sunken paint and a
 * title that says nobody read it. The four paints, and the argument that each
 * is the server's word rather than an inference, live in `pageCell.ts`.
 *
 * ══ WCAG 2.2 §2.5.8 — CELLS UNDER 24px, AND WHY THAT IS THE EXCEPTION ══════
 *
 * §2.5.8 exempts an undersized target when the presentation is ESSENTIAL:
 * PRODUCT.md puts a real package at 36-181 pages, and at 181 cells of 24px the
 * matrix is 4,344px wide, which is not a matrix and not a screen. Every cell
 * also carries a `title` and an `aria-label` naming its page and what happened
 * to it, so what the block encodes in colour is reachable without hitting a
 * 12px target at all. Same finding, same justification, as `CoverageSpine`.
 *
 * ══ THE CLICK TARGET IS THE FROZEN DOOR, WITH A PARAM ══════════════════════
 *
 * INVARIANT 55: deep links land on the exact thing in context, and selection
 * is URL-owned. The route is `/orders/$orderId` (authz.ts:66 covers the
 * prefix) and `page` rides in the search string beside `field`.
 *
 * REFUSED FROM THE DESIGN: its footer's right-hand caption, "Auto-scaling
 * (10k+ pages)". That is a claim about the system's capacity, not a fact any
 * response carries, and nothing on this screen could reconcile it.
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
        {Array.from({ length: props.total }, (_, i) => i + 1).map((n) => {
          const page = byPage.get(n);
          const label = describe(n, page);
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
