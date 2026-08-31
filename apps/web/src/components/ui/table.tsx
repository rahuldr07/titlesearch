import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { chordWidget } from "./overlaySurface";
import type { TableColumn } from "./tableColumns";
import { ROW_HEIGHT, TableHeaderRow, TableRow } from "./tableRow";

/**
 * A grid of divs wearing ARIA, not a <table>: virtualization positions rows
 * absolutely inside a spacer of the full scroll height, and a <tbody> cannot
 * hold absolutely-positioned <tr>s — the table layout algorithm overrides
 * `position`. role="grid" / row / columnheader / gridcell is what assistive
 * tech actually reads.
 *
 * The chord mark is `widget`, never `own`: `own` is read document-wide and
 * suspends every chord for as long as the marked node exists — and a table
 * exists permanently. `widget` stands the vocabulary down only while a row
 * holds focus.
 */
export type TableProps<TRow> = {
  /** The table's accessible name. Required: an unnamed grid is unnavigable. */
  readonly label: string;
  readonly rows: readonly TRow[];
  readonly columns: readonly TableColumn<TRow>[];
  /** Stable identity per row. Never the array index — rows reorder. */
  readonly rowKey: (row: TRow) => string;
  /** Rendered instead of the grid when `rows` is empty. */
  readonly empty: React.ReactNode;
  /**
   * Activating a whole row. Omitted leaves the row inert, as every table
   * written before this one expects. See `tableRow.tsx`: this is a wider MOUSE
   * target over a control that is already inside the row, never a new tab stop
   * and never a link wrapped around a button.
   */
  readonly onRowActivate?: (row: TRow) => void;
};

export function Table<TRow>({
  label,
  rows,
  columns,
  rowKey,
  empty,
  onRowActivate,
}: TableProps<TRow>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    // Eight rows above and below the window: enough that a flung scroll never
    // shows a blank band, small enough that the node count stays flat.
    overscan: 8,
  });

  if (rows.length === 0) return <>{empty}</>;

  const template = columns.map((c) => c.width).join(" ");

  return (
    <div
      ref={scrollRef}
      /*
       * A scrollable region with no focusable content cannot be scrolled from
       * the keyboard (WCAG 2.1.1). The rows carry tabIndex={-1} — tabbing
       * through 5,000 rows is not navigation — so the container itself takes
       * the tab stop and answers to the arrow keys.
       */
      tabIndex={0}
      data-slot="table-container"
      /* The ring comes from `styles.css`'s `[tabindex]:focus-visible` rule, not
         from `tp-ring` — that utility keys off react-aria's `data-focus-visible`,
         which a plain div never receives. */
      className="tp-z-raised relative h-full overflow-auto"
    >
      <div
        {...chordWidget}
        role="grid"
        aria-label={label}
        aria-colcount={columns.length}
        aria-rowcount={rows.length + 1}
        data-slot="table"
        className="min-w-full"
      >
        <TableHeaderRow columns={columns} template={template} />
        {/* The spacer: full scroll height, so the scrollbar tells the truth
            about a set the DOM is only ever holding a window of. */}
        <div
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }} /* rules-allow: a virtualizer's spacer height is computed per scroll frame from the row count — no token or class can express it, and this is the mechanism rather than a shortcut */
        >
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index];
            if (row === undefined) return null;
            return (
              <TableRow
                key={rowKey(row)}
                row={row}
                columns={columns}
                template={template}
                index={item.index}
                offset={item.start}
                onActivate={onRowActivate}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
