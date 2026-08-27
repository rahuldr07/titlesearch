import { cx } from "./cx";
import type { TableColumn } from "./tableColumns";

/**
 * THE HEADER ROW AND THE DATA ROW, SPLIT OUT SO `table.tsx` IS THE MECHANISM
 * AND THIS IS THE CHROME.
 *
 * `ROW_HEIGHT` lives here rather than in `table.tsx` because it is a fact
 * about how a row is DRAWN, and the virtualizer is merely the thing that has
 * to be told. 44px is `--size-control-2xl` and is comfortably above WCAG
 * 2.5.8's 24px target minimum, which matters because a row is clickable.
 */
export const ROW_HEIGHT = 44;

/**
 * The header. Sticky, on `--color-control-fill` with a `--color-line-strong`
 * rule beneath — RECIPES.md §Card's header row, at the 11px w700 label rung in
 * sentence case (rule 4: ALL-CAPS is legal only on rail rubrics and serif
 * certificate headings, and this is neither).
 */
export function TableHeaderRow<TRow>({
  columns,
  template,
}: {
  readonly columns: readonly TableColumn<TRow>[];
  readonly template: string;
}) {
  return (
    <div
      role="row"
      data-slot="table-header"
      className="tp-z-raised sticky top-0 grid border-b border-line-strong bg-control-fill"
      style={{ gridTemplateColumns: template }} /* rules-allow: the column track list is caller data (tableColumns.tsx) with no fixed value set a utility could enumerate */
    >
      {columns.map((column) => (
        <div
          key={column.id}
          role="columnheader"
          className="truncate px-8 py-5 text-left font-sans text-label leading-flat font-bold text-ink-muted"
        >
          {column.header}
        </div>
      ))}
    </div>
  );
}

/** One row. Hover lifts to `--color-row-hover` and NOTHING else moves. */
export function TableRow<TRow>({
  row,
  columns,
  template,
  index,
  offset,
}: {
  readonly row: TRow;
  readonly columns: readonly TableColumn<TRow>[];
  readonly template: string;
  readonly index: number;
  readonly offset: number;
}) {
  return (
    <div
      role="row"
      aria-rowindex={index + 1}
      tabIndex={-1}
      data-slot="table-row"
      className={cx(
        "tp-state tp-ring absolute top-0 left-0 grid w-full items-center",
        "border-b border-line-subtle hover:bg-row-hover",
      )}
      style={{ gridTemplateColumns: template, height: ROW_HEIGHT, transform: `translateY(${offset}px)` }} /* rules-allow: the Y offset comes from the virtualizer per frame and the track list is caller data; neither is expressible as a class */
    >
      {columns.map((column) => (
        <div
          key={column.id}
          role="gridcell"
          data-column={column.id}
          className="truncate px-8 font-sans text-body leading-close text-ink-primary"
        >
          {column.cell(row)}
        </div>
      ))}
    </div>
  );
}
