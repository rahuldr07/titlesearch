import { DataCell, statusColumn, type TableColumn } from "./tableColumns";

/**
 * THE STORY FIXTURE, SPLIT OUT SO THE STORIES ARE ABOUT THE TABLE.
 *
 * Real vocabulary rather than "Row 1 / Row 2": order refs in mono, county
 * names, examiner initials. A fixture written in placeholder text is a fixture
 * that never shows the truncation or the mono/sans mix that a real screen has.
 */
export type Order = {
  readonly ref: string;
  readonly county: string;
  readonly examiner: string;
  readonly mark: "settled" | "attend" | "halt";
};

const MARKS = ["settled", "attend", "halt"] as const;
const COUNTIES = ["Travis", "Tarrant", "Harris", "Bexar"] as const;

/**
 * FIVE THOUSAND ROWS, and the number is not arbitrary: review found the
 * previous DataTable rendering all 5,000 of them — 35,000 nodes — so the story
 * that proves the fix has to be the size that broke it.
 */
export function orders(count: number): readonly Order[] {
  return Array.from({ length: count }, (_, i) => ({
    ref: `TP-${String(100000 + i)}`,
    county: COUNTIES[i % COUNTIES.length] ?? "Travis",
    examiner: i % 3 === 0 ? "R. Nayar" : "K. Osei",
    mark: MARKS[i % MARKS.length] ?? "settled",
  }));
}

export const columns: readonly TableColumn<Order>[] = [
  /*
   * THE one status column. Rule 6: at most one status signal per row, mark
   * plus weight, and no other column here carries a capsule, a tone or a dot.
   */
  statusColumn<Order>((row) => ({
    mark: row.mark,
    label:
      row.mark === "settled"
        ? "Settled"
        : row.mark === "attend"
          ? "Needs review"
          : "Halted",
  })),
  {
    id: "ref",
    header: "Order",
    width: "minmax(0,1fr)",
    cell: (r) => <DataCell>{r.ref}</DataCell>,
  },
  { id: "county", header: "County", width: "minmax(0,1fr)", cell: (r) => r.county },
  {
    id: "examiner",
    header: "Examiner",
    width: "minmax(0,1fr)",
    cell: (r) => r.examiner,
  },
];

