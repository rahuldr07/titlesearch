import type { ReactNode } from "react";

/**
 * WHAT A COLUMN IS, AND WHY IT IS DATA RATHER THAN A COMPONENT.
 *
 * The virtualized table has to know each column's WIDTH before it renders a
 * row, because a virtualized grid is absolutely positioned and cannot ask the
 * browser to lay a table out. So a column is a record — width included — and
 * not a `<Column>` element the table would have to introspect.
 *
 * `width` is in GRID TRACK syntax (`1fr`, `min-content`, a spacing utility's
 * worth of pixels expressed as a fraction) and is passed straight to
 * `grid-template-columns`. It is the one place this kit lets a caller name a
 * size, and it is unavoidable: column widths are a property of the DATA, not of
 * the design system.
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
  /** The header's sentence-case label. Rule 4 — no ALL-CAPS here. */
  readonly header: string;
  /** A `grid-template-columns` track, e.g. `"1fr"` or `"minmax(0,2fr)"`. */
  readonly width: string;
  /**
   * Which edge the header AND its cells sit against. Omitted is `"start"`, so
   * every column written before this renders unchanged.
   *
   * It is one member rather than two because the defect it exists to close was
   * a header disagreeing with its own cells: All Orders right-aligned Due and
   * Action inside `cell` while the header stayed left, and a column whose two
   * halves can be aligned separately is a column that will drift apart again.
   */
  readonly align?: ColumnAlign;
  /** Renders one cell. Return a plain node; the cell chrome is the table's. */
  readonly cell: (row: TRow) => ReactNode;
};

/**
 * RULE 6 IS A BUDGET THIS TABLE CANNOT ENFORCE, ONLY MAKE VISIBLE.
 *
 * "A table row carries at most ONE status signal — weight and position first,
 * capsule last." A table cannot count signals inside cells it renders
 * opaquely: a column's `cell` returns an arbitrary node.
 *
 * What it CAN do is offer exactly ONE structural place for a status and no
 * others. That is `statusColumn` below — a fixed, narrow, first column drawn
 * with rule 7's glyph vocabulary and nothing else. There is deliberately no
 * `rowTone`, no `getRowClassName`, no striping and no per-row colour anywhere
 * in `table.tsx`, so a SECOND signal has to be hand-written into a cell, where
 * review sees it.
 */
/*
 * NAMED `RowStatus`, NOT `StatusMark`: `badge.tsx` already exports a COMPONENT
 * called `StatusMark`, and a type and a component sharing a name in one barrel
 * is a duplicate-identifier error rather than a style question. This is the
 * row's status VALUE; that one draws a mark.
 */
export type RowStatus = "settled" | "attend" | "halt";

/** The glyphs. Rule 7 names the whole vocabulary: ✓ ◆ • T1. Nothing else. */
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
 * The one status column a table may have.
 *
 * The mark is `aria-hidden` and the SENTENCE is what a screen reader gets:
 * a glyph read aloud as "black diamond" tells a reader nothing, and rule 6's
 * mark-plus-weight grammar is a visual one. Colour is never the only carrier —
 * the glyph differs per state, so the distinction survives greyscale.
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

/**
 * A mono cell, for the things rule 3 names: order refs, money, citations,
 * hashes, timestamps. A column definition opts in by WRAPPING rather than by a
 * `mono: true` flag the table would have to interpret — which would be the
 * table knowing what its data means.
 */
export function DataCell({ children }: { readonly children: ReactNode }) {
  return <span className="font-mono text-meta leading-close text-ink-secondary">{children}</span>;
}
