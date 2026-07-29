import { useQuery } from "@tanstack/react-query";
import type { OrderPagesResponse, SourcePage } from "@titlepipe/contract";
import { pagesQuery } from "./queries";
import { Card, CardBody } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { cn } from "../../shared/ui/classNames";

/**
 * The coverage spine — one cell for every page IN THE PACKAGE, not every page
 * a reader typed.
 *
 * `PageStrip` (entities/document) answers "which pages were read in full" by
 * listing them — and only them. That is the right question for "where can I
 * navigate", but it cannot answer the question this component exists for:
 * "what have I not looked at" (CONTEXT §11). A list of 11 chips out of a
 * 64-page package has no representation AT ALL for the other 53 — they are
 * not shown as skipped, they are simply absent, which reads as "the package
 * has 11 pages" to anyone who has not memorised the denominator elsewhere on
 * screen. The spine renders every `total_pages` cell so the un-read majority
 * is a VISIBLE state, not a gap in the list.
 *
 * FOUR STATES, ALL SERVER-SUPPLIED, NEVER INFERRED:
 *   read     — found in `pages`, `read_in_full: true`, `degraded: false`
 *   degraded — found, `read_in_full: true`, `degraded: true`
 *   partial  — found, `read_in_full: false` (present, not read in full —
 *              normal, per CONTEXT §11: most pages carry nothing the report
 *              needs)
 *   unseen   — page number absent from `pages` entirely. Still NORMAL, not a
 *              gap — it just means no reader ever typed it.
 * `degraded` is only consulted once a page is confirmed read in full,
 * mirroring `PageFacsimile`'s own precedence, so this file never invents a
 * fifth combination the server did not send.
 *
 * The two NA-adjacent states here (`partial` vs `unseen`) must stay as
 * distinct as the field-level NA states do — collapsing "present but skipped"
 * into "never served" would hide that the classifier looked at the page and
 * chose not to read it, which is a different fact from the page not existing
 * in the served text at all.
 */

type CellState = "read" | "degraded" | "partial" | "unseen";

/**
 * Colour is not the only signal — same reasoning as `NoValue`'s six states
 * (CONTEXT §11): `unseen` takes a DASHED border, the same "quiet, correct, not
 * a gap" treatment `NoValue`'s `not_present` uses, so the majority state reads
 * as normal under greyscale or colour-blindness too, not just by hue.
 */
const CELL_STYLE: Record<CellState, string> = {
  read: "border-state-settled bg-state-settled-surface",
  degraded: "border-state-attend bg-state-attend-surface",
  partial: "border-state-idle-border bg-state-idle-surface",
  unseen: "border-dashed border-line-strong bg-surface-app",
};

const CELL_LABEL: Record<CellState, string> = {
  read: "read in full",
  degraded: "read in full — degraded scan",
  partial: "present, not read in full",
  unseen: "not served — no reader typed this page",
};

function classify(page: SourcePage | undefined): CellState {
  if (page === undefined) return "unseen";
  if (!page.read_in_full) return "partial";
  if (page.degraded) return "degraded";
  return "read";
}

export function CoverageSpine({ coverage }: { coverage: OrderPagesResponse }) {
  const byPage = new Map(coverage.pages.map((page) => [page.n, page]));
  const cells = Array.from({ length: coverage.total_pages }, (_, i) => {
    const n = i + 1;
    return { n, state: classify(byPage.get(n)) };
  });
  const counts: Record<CellState, number> = { read: 0, degraded: 0, partial: 0, unseen: 0 };
  for (const cell of cells) counts[cell.state] += 1;

  return (
    <Card data-testid="coverage-spine">
      <CardBody className="flex flex-col gap-5">
        <Eyebrow variant="section">Coverage</Eyebrow>
        <p className="text-xs text-ink-secondary">
          Coverage · all {coverage.total_pages} pages
        </p>

        <div className="flex flex-wrap gap-2">
          {cells.map((cell) => (
            <span
              key={cell.n}
              data-testid="coverage-cell"
              role="img"
              aria-label={`page ${cell.n}, ${CELL_LABEL[cell.state]}`}
              title={`p${cell.n} · ${CELL_LABEL[cell.state]}`}
              className={cn("size-9 rounded-2 border", CELL_STYLE[cell.state])}
            />
          ))}
        </div>

        <ul className="flex flex-wrap gap-6">
          {(Object.keys(CELL_LABEL) as CellState[]).map((state) => (
            <li key={state} className="flex items-center gap-3 text-tiny text-ink-muted">
              <span
                aria-hidden
                className={cn("size-5 rounded-1 border", CELL_STYLE[state])}
              />
              {CELL_LABEL[state]} ({counts[state]})
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

/**
 * The connected host. Runs the SAME query key `DocumentColumn` already fetches
 * (React Query dedupes by key, so this costs no extra request), separately —
 * a partial failure in one region must not blank the other (`errors.spec` #2).
 * Renders nothing until the package's page list resolves, rather than a
 * spine drawn against a stale or zero total.
 */
export function OrderCoverageSpine({ orderId }: { orderId: string }) {
  const { data } = useQuery(pagesQuery(orderId));
  return data ? <CoverageSpine coverage={data} /> : null;
}
