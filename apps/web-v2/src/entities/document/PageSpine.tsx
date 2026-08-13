import { CELL_LABEL, cellClasses, coverageCounts } from "./pageCoverage";
import type { PageSpineCell, PageSpineTier } from "./pageCoverage";
import { cn } from "../../shared/ui/classNames";

const TIERS: readonly PageSpineTier[] = ["read", "degraded", "partial", "unseen"];

/**
 * ONE ELEMENT EMITS `coverage-cell`, and it is this one.
 *
 * RULE: a testid a release gate counts has exactly one producer. FAILURE
 * PREVENTED: `features/review/CoverageSpine` carried a line-for-line copy of
 * this grid — same four tiers, same labels, same testid — so the moment both
 * mounted, `review.spec`'s `toHaveCount(64)` saw 128 and the gate failed on a
 * duplicate rather than on a regression. Whether the spine is a picture or a
 * control is a prop, not a second implementation.
 *
 * WHEN `onSelect` IS PRESENT EVERY CELL IS A REAL `<button>`. A `<span onClick>`
 * is neither focusable nor announced, and the spine is the only way to reach a
 * page nothing cited. When it is absent the spine is a picture — `role="img"`
 * with the same accessible name — because a cell that looks clickable and does
 * nothing is worse than a cell that never claimed to be. The tier travels in the
 * name either way, so a screen-reader user gets the fact the fill carries and
 * not merely a page number.
 *
 * THE CURRENT PAGE OVERRIDES ITS TIER FILL rather than adding a second mark, as
 * the export does (`:3057`). Losing one square's tier to say "you are here" is
 * cheap; two marks on one 13px square is a square nobody can read. `aria-current`
 * carries the same fact where colour does not reach.
 *
 * THE SQUARE IS 13px ON A 3px GUTTER — the mockup's measured grid, against the
 * 18px/4px this shipped at. RULE: the spine's job is to be READ AS A SHAPE — a
 * whole package in one glance, so a run of unread pages is a visible block
 * rather than a count. FAILURE PREVENTED: at 22px pitch a 64-page package ran
 * wider than the document pane and wrapped to three ragged rows with the last
 * one a third full; the mockup's 16px pitch lands the same 64 squares in two
 * even rows, which is the only arrangement in which "how much of this package
 * did anyone read" is answerable without counting.
 *
 * THE COST, STATED: 13px is a smaller pointer target than the 18px it replaces,
 * and neither clears WCAG 2.5.8's 24px. The exception the spine relies on is
 * the equivalent control — `PageNav`'s prev/next and page field reach every
 * page of the package at full size, and every cell is focusable and named, so
 * the keyboard path is unaffected. Flagged as a cost of matching the mockup's
 * density, not argued away: if the owner wants the target back, the number to
 * move is here and the legend swatch below it stays as it is.
 *
 * THE LEGEND COUNTS THE SQUARES DRAWN ABOVE IT and claims nothing else. The
 * buckets are the ones that coloured the cells, so the words can never disagree
 * with the map — and the denominator is `total_pages`, walked by
 * `coverageCells`, never a length this component measured for itself.
 */
export interface PageSpineProps {
  /** Server-classified, one per package page. Built by `coverageCells`. */
  cells: readonly PageSpineCell[];
  /** Marks "you are here" when the spine is being used to navigate. */
  currentPage?: number | undefined;
  /** Present ⇒ every cell is a button. Absent ⇒ the spine is a picture. */
  onSelect?: ((n: number) => void) | undefined;
}

function CoverageCell({
  cell,
  current,
  onSelect,
}: {
  cell: PageSpineCell;
  current: boolean;
  onSelect: ((n: number) => void) | undefined;
}) {
  // One place builds the cell's identity, so the picture and the control can
  // never drift into two different squares — or two different testids.
  const shared = {
    "data-testid": "coverage-cell",
    "aria-label": `page ${cell.n}, ${CELL_LABEL[cell.tier]}`,
    "aria-current": current ? ("page" as const) : undefined,
    title: `p${cell.n} · ${CELL_LABEL[cell.tier]}`,
    className: cn(
      "size-6.5",
      cellClasses({ tier: cell.tier }),
      current && "border-solid border-action bg-action",
    ),
  };

  if (onSelect === undefined) return <span {...shared} role="img" />;
  return <button {...shared} type="button" onClick={() => onSelect(cell.n)} />;
}

export function PageSpine({ cells, currentPage, onSelect }: PageSpineProps) {
  const counts = coverageCounts(cells);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-1.5">
        {cells.map((cell) => (
          <CoverageCell
            key={cell.n}
            cell={cell}
            current={cell.n === currentPage}
            onSelect={onSelect}
          />
        ))}
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
