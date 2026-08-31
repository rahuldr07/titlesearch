import { DataCell, statusColumn, type TableColumn } from "./tableColumns";

/**
 * The story fixture, in real vocabulary rather than "Row 1 / Row 2" — a
 * fixture written in placeholder text never shows the truncation or the
 * mono/sans mix a real screen has.
 */
export type Order = {
  readonly ref: string;
  readonly county: string;
  readonly examiner: string;
  readonly mark: "settled" | "attend" | "halt";
};

const MARKS = ["settled", "attend", "halt"] as const;
const COUNTIES = ["Travis", "Tarrant", "Harris", "Bexar"] as const;

export function orders(count: number): readonly Order[] {
  return Array.from({ length: count }, (_, i) => ({
    ref: `TP-${String(100000 + i)}`,
    county: COUNTIES[i % COUNTIES.length] ?? "Travis",
    examiner: i % 3 === 0 ? "R. Nayar" : "K. Osei",
    mark: MARKS[i % MARKS.length] ?? "settled",
  }));
}

export const columns: readonly TableColumn<Order>[] = [
  // The one status column — no other column carries a capsule, tone or dot.
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

