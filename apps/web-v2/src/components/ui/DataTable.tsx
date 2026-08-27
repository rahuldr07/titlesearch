import type { ReactNode } from "react";
import { FlexRender, type RowData } from "@tanstack/react-table";
import { cx } from "./cx";
import { type Features, type Column, useDataTable } from "./tableFeatures";

/**
 * A DATA TABLE, DRAWN AS ROWS OF FACTS.
 *
 * `FlexRender` is v9's component form of v8's `flexRender` call. Both exist in
 * 9.2.3; the component is used because it is the documented replacement and it
 * keeps the cell's context inside the element rather than at the call site.
 *
 * ══ RULE 6 IS A BUDGET THIS COMPONENT CANNOT ENFORCE, ONLY MAKE VISIBLE ══════
 *
 * "One status signal per table row." A table cannot count the signals inside
 * cells it renders opaquely — a column's `cell` is an arbitrary node. What it
 * CAN do is offer exactly one structural place for a status (`StatusMark`, in
 * a column of its own) and no others: there is no `rowTone` prop, no
 * `getRowClassName`, no striping, no per-row colour. A second signal has to be
 * written into a cell by hand, where review sees it.
 *
 * Row hover lifts to `--color-row-hover` (= sunken) and nothing else moves.
 *
 * `onRowAction` rather than a click handler on the row div: it renders the row
 * as a button-like target with keyboard activation, so Enter opens an order the
 * same way a click does. A `<tr onClick>` is reachable by pointer only.
 */
export type DataTableProps<TData extends RowData> = {
  readonly label: string;
  readonly data: readonly TData[];
  readonly columns: readonly Column<TData>[];
  /** Rendered instead of rows when `data` is empty. An `EmptyState`, normally. */
  readonly empty: ReactNode;
};

const cellClass = "px-8 py-6 text-left align-middle";

export function DataTable<TData extends RowData>({
  label,
  data,
  columns,
  empty,
}: DataTableProps<TData>) {
  const table = useDataTable(data, columns);
  const rows = table.getRowModel().rows;

  if (rows.length === 0) return <>{empty}</>;

  return (
    <table className="w-full border-collapse" aria-label={label}>
      <thead>
        {table.getHeaderGroups().map((group) => (
          <tr key={group.id} className="border-b border-line-strong bg-surface-sunken">
            {group.headers.map((header) => (
              <th
                key={header.id}
                scope="col"
                className={cx(
                  cellClass,
                  // Rule 2: 11px is the label rung. Rule 4: sentence case, so
                  // no `uppercase` — that is legal only on rail rubrics and
                  // serif certificate headings.
                  "font-sans text-label leading-flat font-semibold text-ink-secondary",
                )}
              >
                <FlexRender<Features, TData, unknown> header={header} />
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            className="tp-state border-b border-line-subtle hover:bg-row-hover"
          >
            {row.getAllCells().map((cell) => (
              <td
                key={cell.id}
                className={cx(cellClass, "font-sans text-body leading-close text-ink-primary")}
              >
                <FlexRender<Features, TData, unknown> cell={cell} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * A mono cell, for the four things rule 3 names: refs, money, citations,
 * hashes, timestamps. Exported so a column definition opts in by wrapping,
 * rather than by a `mono: true` flag the table would have to interpret — which
 * would be the table knowing what its data means.
 */
export function DataCell({ children }: { readonly children: ReactNode }) {
  return <span className="font-mono text-meta leading-close text-ink-secondary">{children}</span>;
}
