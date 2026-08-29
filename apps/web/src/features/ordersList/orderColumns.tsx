import type { OrderRow } from "@titlepipe/contract";
import { cx, buttonVariants, DataCell, type TableColumn } from "../../components/ui";
import { RouteButton } from "../../app/chrome/RouteButton";
import { useOverlays } from "../../app/keyboard/overlays";
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
    header: "Order ref",
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
    /*
     * The reference's two row actions: the audit-history modal, then Open →.
     * The clock button is the call site `openOrderHistory` was built for —
     * it names the order for the ONE history overlay (`app/keyboard/overlays.ts`
     * argues why a second copy of that surface was refused). A native
     * `<button>` in the kit's chrome, because react-aria's Button drops
     * `title` and the reference draws a tooltip-bearing icon; `getState()`
     * rather than the hook because a cell is a render function, not a
     * component (same imperative seam `shared/session.ts` uses).
     */
    cell: (row) => (
      <span className="flex items-center justify-end gap-4">
        <button
          type="button"
          title="Inspect full audit history"
          aria-label={`Inspect the full audit history of order ${row.order_ref}`}
          onClick={() => useOverlays.getState().openOrderHistory(row.id)}
          className={cx(
            buttonVariants({ variant: "secondary", size: "sm", icon: true }),
            "text-ink-muted",
          )}
        >
          {/* The reference's clock glyph, verbatim. */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M12 8v4l3 3" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </button>
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
