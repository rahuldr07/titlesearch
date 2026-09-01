import type { OrderRow } from "@titlepipe/contract";
import { cx, buttonVariants, DataCell, type TableColumn } from "../../components/ui";
import { RouteButton } from "../../app/chrome/RouteButton";
import { useOverlays } from "../../app/keyboard/overlays";
import { STAGE_LABEL } from "../../entities/order/stageLabel";
import { Absent, Address } from "./orderCells";

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
    /* The server's label, verbatim. No countdown is derived from it. */
    cell: (row) =>
      row.due === null ? (
        <Absent>No due date</Absent>
      ) : (
        <span className="block text-right font-mono text-meta leading-tight text-balance text-ink-secondary">
          {row.due}
        </span>
      ),
  },
  {
    id: "action",
    header: "Action",
    /* Wide enough for both actions — at 120px the clock clipped into Due. */
    width: "150px",
    /*
     * Two row actions: the audit-history modal, then Open →. The clock
     * button names the order for the one history overlay. A native
     * `<button>` because react-aria's Button drops `title`; `getState()`
     * rather than the hook because a cell is a render function, not a
     * component.
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
          {/* The clock glyph. */}
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
