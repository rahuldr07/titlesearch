import type { ReactNode } from "react";

/**
 * A column is a record, not a component: the virtualized table has to know
 * each column's width before it renders a row. `width` is grid-track syntax,
 * passed straight to grid-template-columns — the one place this kit lets a
 * caller name a size, because column widths are a property of the data.
 */
export type ColumnAlign = "start" | "end";

/** The one place the two edges are spelled, for the header and the cell alike. */
export const ALIGN_CLASS: Readonly<Record<ColumnAlign, string>> = {
  start: "text-left",
  end: "text-right",
};

export type TableColumn<TRow> = {
  /** Stable id. Used as the React key and as the cell's `data-column`. */
  readonly id: string;
  /** The header's sentence-case label. */
  readonly header: string;
  /** A `grid-template-columns` track, e.g. `"1fr"` or `"minmax(0,2fr)"`. */
  readonly width: string;
  /**
   * Which edge the header and its cells sit against; omitted is "start".
   * One member rather than two — a column whose header and cells can be
   * aligned separately is a column that will drift apart.
   */
  readonly align?: ColumnAlign;
  /** Renders one cell. Return a plain node; the cell chrome is the table's. */
  readonly cell: (row: TRow) => ReactNode;
};

/**
 * A table cannot count signals inside cells it renders opaquely, so it
 * offers exactly one structural place for a status — `statusColumn` — and
 * deliberately no rowTone, getRowClassName, striping or per-row colour: a
 * second signal has to be hand-written into a cell, where review sees it.
 * Named RowStatus, not StatusMark — badge.tsx already exports a component by
 * that name and the barrel would collide.
 */
export type RowStatus = "settled" | "attend" | "halt";

/** The closed glyph vocabulary. */
const MARK_GLYPH: Readonly<Record<RowStatus, string>> = {
  settled: "✓",
  attend: "◆",
  halt: "•",
};

const MARK_INK: Readonly<Record<RowStatus, string>> = {
  settled: "text-state-settled-muted",
  attend: "text-state-attend",
  halt: "text-state-halt font-semibold",
};

/**
 * The one status column a table may have. The mark is aria-hidden and the
 * sentence is what a screen reader gets — a glyph read aloud as "black
 * diamond" tells a reader nothing. The glyph differs per state, so the
 * distinction survives greyscale.
 */
export function statusColumn<TRow>(
  read: (row: TRow) => { readonly mark: RowStatus; readonly label: string },
): TableColumn<TRow> {
  return {
    id: "status",
    header: "Status",
    width: "min-content",
    cell: (row) => {
      const { mark, label } = read(row);
      return (
        <span className="flex items-center gap-3">
          <span aria-hidden className={MARK_INK[mark]}>
            {MARK_GLYPH[mark]}
          </span>
          <span className="sr-only">{label}</span>
        </span>
      );
    },
  };
}
