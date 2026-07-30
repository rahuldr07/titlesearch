import { CELL_LABEL, cellClasses, coverageCounts } from "./pageCoverage";
import type { PageSpineCell, PageSpineTier } from "./pageCoverage";
import { cn } from "../../shared/ui/classNames";

const TIERS: readonly PageSpineTier[] = ["read", "degraded", "partial", "unseen"];

/**
 * The coverage spine: one cell for every page IN THE PACKAGE, clickable.
 *
 * RULE: one instrument, one denominator. FAILURE PREVENTED: the review pane
 * drew this spine over 64 cells and `PageStrip` listed 7 chips a scroll below
 * it, so one pane stated two different package sizes and a reader had no way to
 * know which was the package. The cells arrive already classified, so the two
 * renders cannot drift apart again by classifying separately.
 *
 * EVERY CELL IS A REAL `<button>`. A `<span onClick>` is neither focusable nor
 * announced, and the spine is the only way to reach a page nothing cited. The
 * tier travels in the accessible name, so a screen-reader user gets the fact
 * the fill carries and not merely a page number.
 *
 * THE CURRENT PAGE OVERRIDES ITS TIER FILL rather than adding a second mark, as
 * the export does (`:3057`). Losing one square's tier to say "you are here" is
 * cheap; two marks on one 18px square is a square nobody can read. `aria-current`
 * carries the same fact where colour does not reach.
 *
 * THE LEGEND COUNTS THE SQUARES DRAWN ABOVE IT and claims nothing else. The
 * buckets are the ones that coloured the cells, so the words can never disagree
 * with the map — and the denominator is `total_pages`, walked by
 * `coverageCells`, never a length this component measured for itself.
 */
export interface PageSpineProps {
  /** Server-classified, one per package page. Built by `coverageCells`. */
  cells: readonly PageSpineCell[];
  currentPage: number;
  onSelect: (n: number) => void;
}

export function PageSpine({ cells, currentPage, onSelect }: PageSpineProps) {
  const counts = coverageCounts(cells);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {cells.map((cell) => {
          const current = cell.n === currentPage;
          return (
            <button
              key={cell.n}
              type="button"
              data-testid="coverage-cell"
              aria-label={`page ${cell.n}, ${CELL_LABEL[cell.tier]}`}
              aria-current={current ? "page" : undefined}
              title={`p${cell.n} · ${CELL_LABEL[cell.tier]}`}
              onClick={() => onSelect(cell.n)}
              className={cn(
                "size-9",
                cellClasses({ tier: cell.tier }),
                current && "border-solid border-action bg-action",
              )}
            />
          );
        })}
      </div>

      <ul className="flex flex-wrap gap-6">
        {TIERS.map((tier) => (
          <li key={tier} className="flex items-center gap-3 text-tiny text-ink-muted">
            <span aria-hidden className={cn("size-5", cellClasses({ tier }))} />
            {CELL_LABEL[tier]} ({counts[tier]})
          </li>
        ))}
      </ul>
    </div>
  );
}
