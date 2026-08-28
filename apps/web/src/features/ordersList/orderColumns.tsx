import type { OrderRow } from "@titlepipe/contract";
import { DataCell, type TableColumn } from "../../components/ui";
import { RouteButton } from "../../app/chrome/RouteButton";
import { Absent, Address } from "./orderCells";

/** The enum's own words, capitalised — so `stage:gate` still finds the "Gate" row. */
const STAGE_LABEL: Readonly<Record<OrderRow["stage"], string>> = {
  unassigned: "Unassigned",
  intake: "Intake",
  machine: "Machine",
  gate: "Gate",
  review: "Review",
  escalated: "Escalated",
  delivered: "Delivered",
};

export const ORDER_COLUMNS: readonly TableColumn<OrderRow>[] = [
  {
    id: "ref",
    header: "Ref",
    width: "130px",
    cell: (row) => <DataCell>{row.order_ref}</DataCell>,
  },
  {
    id: "addr",
    header: "Property address",
    width: "minmax(0,1fr)",
    cell: (row) => <Address row={row} />,
  },
  {
    id: "client",
    header: "Client",
    width: "170px",
    cell: (row) => (
      <span className="truncate text-meta leading-close text-ink-secondary">{row.client}</span>
    ),
  },
  {
    id: "stage",
    header: "Stage",
    width: "110px",
    cell: (row) => (
      <span className="truncate text-meta leading-close text-ink-secondary">
        {STAGE_LABEL[row.stage]}
      </span>
    ),
  },
  {
    id: "assigned",
    header: "Assigned",
    width: "120px",
    cell: (row) =>
      row.assigned_to === null ? (
        <Absent>Unassigned</Absent>
      ) : (
        <span className="truncate text-meta leading-close text-ink-secondary">
          {row.assigned_to}
        </span>
      ),
  },
  {
    id: "due",
    header: "Due",
    width: "130px",
    /* The server's label, verbatim. INVARIANT 23: no countdown is derived from it. */
    cell: (row) =>
      row.due === null ? (
        <Absent>No due date</Absent>
      ) : (
        <span className="block truncate text-right font-mono text-meta leading-close text-ink-secondary">
          {row.due}
        </span>
      ),
  },
  {
    id: "action",
    header: "Action",
    width: "120px",
    cell: (row) => (
      <span className="flex justify-end">
        <RouteButton
          to="/orders/$orderId"
          params={{ orderId: row.id }}
          size="sm"
          aria-label={`Open order ${row.order_ref}`}
        >
          Open →
        </RouteButton>
      </span>
    ),
  },
];
