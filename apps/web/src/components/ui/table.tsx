import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { chordWidget } from "./overlaySurface";
import type { TableColumn } from "./tableColumns";
import { ROW_HEIGHT, TableHeaderRow, TableRow } from "./tableRow";

/**
 * A TABLE THAT VIRTUALIZES, BECAUSE THE PREVIOUS ONE DID NOT.
 *
 * Review found the old DataTable rendering all 5,000 rows of an order list:
 * 5,000 × 7 cells is 35,000 DOM nodes, and the browser spends the first two
 * seconds of the screen laying them out. `@tanstack/react-virtual` renders the
 * window plus an overscan and nothing else.
 *
 * ══ WHY THIS IS A GRID OF DIVS AND NOT `<table>` ════════════════════════════
 *
 * Virtualization positions rows ABSOLUTELY inside a spacer of the full scroll
 * height. A `<tbody>` cannot hold absolutely-positioned `<tr>`s — the table
 * layout algorithm overrides `position` — so a virtualized `<table>` needs
 * either fixed row heights faked with padding rows or `display: grid` on the
 * table itself, at which point it is a grid of divs wearing table tags. So it
 * is a grid of divs wearing ARIA: `role="grid"` / `row` / `columnheader` /
 * `gridcell`, which is what assistive tech actually reads, and which is
 * exactly the role set `focusRoles.ts` tables.
 *
 * ══ THE CHORD MARK, AND WHY IT IS `widget` AND NOT `own` ════════════════════
 *
 * A focused row in a 5,000-row table killing every chord in the app is the
 * defect review found. `focusRoles.ts` is explicit: `own` is read
 * DOCUMENT-WIDE by `overlayIsUp()`, so it suspends every chord for as long as
 * the marked node EXISTS — and a table exists permanently. Marking this `own`
 * would kill the vocabulary for the lifetime of the screen, whether or not
 * anyone had focused a row.
 *
 * `widget` is read only against the ACTIVE ELEMENT's ancestors, so it stands
 * the vocabulary down while a row holds focus and not one keystroke longer.
 * `focusOwnsKeys` also matches `role="row"` and the `[role='grid']` ancestor
 * directly; this mark is the defence in depth behind both.
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
};

export function Table<TRow>({ label, rows, columns, rowKey, empty }: TableProps<TRow>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    /*
     * Eight rows above and below the window. Enough that a held PageDown or a
     * flung scroll never shows a blank band, small enough that the node count
     * stays flat. Not tuned further without a measurement to tune against.
     */
    overscan: 8,
  });

  if (rows.length === 0) return <>{empty}</>;

  const template = columns.map((c) => c.width).join(" ");

  return (
    <div
      ref={scrollRef}
      data-slot="table-container"
      className="tp-z-raised relative h-full overflow-auto"
    >
      <div
        {...chordWidget}
        role="grid"
        aria-label={label}
        aria-rowcount={rows.length}
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
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
