import {
  useTable,
  tableFeatures,
  createCoreRowModel,
  createColumnHelper,
  type RowData,
} from "@tanstack/react-table";

/**
 * THE TABLE FEATURE SET, DECLARED ONCE.
 *
 * v9 IS NOT v8 AND THE DIFFERENCE IS NOT COSMETIC. In v8 a row model was a
 * function passed as an option (`getCoreRowModel: getCoreRowModel()`); in v9 it
 * is a FACTORY registered in a `features` object (`coreRowModel:
 * createCoreRowModel()`), and the table's type is parameterised by which
 * features are present. Verified against the installed 9.2.3: `createCoreRowModel`
 * and `tableFeatures` are both exported from `@tanstack/table-core` and
 * re-exported by `@tanstack/react-table`; `getCoreRowModel` does not exist
 * outside the `/legacy` entry point.
 *
 * The consequence worth knowing: a feature not listed here is not merely
 * unavailable at runtime, its methods are ABSENT FROM THE TYPE. Sorting and
 * pagination are deliberately not registered — the server owns ordering and
 * paging (AGENTS.md: "Server owns all state machines"; §Screens 3's All Orders
 * table is server-paginated at 10/page) and a client-side sort would silently
 * reorder one page of a set it cannot see.
 *
 * `tableFeatures` is called at module scope, as its own docs require: it is a
 * static description, and constructing it per render would rebuild the table's
 * type identity on every pass.
 */
export const features = tableFeatures({
  coreRowModel: createCoreRowModel(),
});

export type Features = typeof features;

/**
 * A column definition for this app's tables, with the feature set already bound.
 *
 * Taken as the RETURN TYPE of the helper's own `columns()` rather than written
 * as `ColumnDef<Features, TData, unknown>`. The difference is load-bearing:
 * `accessor("ref", …)` produces a `ColumnDef<…, Order, string>`, and v9's
 * ColumnDef is INVARIANT in its value type (the `in out` markers are on the
 * core interfaces), so an array of differently-typed accessor columns is not
 * assignable to an array of `unknown`-valued ones. TanStack ships `columns()`
 * for exactly this — its doc comment reads "wraps an array of column
 * definitions to preserve each column's individual TValue type" — and deriving
 * from it means this alias cannot drift from the library's own answer.
 */
export type Column<TData extends RowData> = ReturnType<
  ReturnType<typeof columnsFor<TData>>["columns"]
>[number];

/**
 * A column helper bound to the feature set, so a screen never re-states it.
 * Called per data type: `const column = columnsFor<Order>()`.
 */
export function columnsFor<TData extends RowData>() {
  return createColumnHelper<Features, TData>();
}

/**
 * The table instance. Data and columns in, a row model out.
 *
 * Thin on purpose. Every stateful thing a table normally does — filter, sort,
 * paginate, select — is either the server's or the screen's, and a hook that
 * offered them here would be offering the client a second source of truth for
 * numbers rule 11 requires to reconcile.
 */
export function useDataTable<TData extends RowData>(
  data: readonly TData[],
  columns: readonly Column<TData>[],
) {
  return useTable<Features, TData>({
    features,
    data: [...data],
    columns: [...columns],
  });
}
