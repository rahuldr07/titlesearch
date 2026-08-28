import type { EngineRoutingCell } from "@titlepipe/contract";
import { Empty, Table, type TableColumn } from "../../components/ui";

/**
 * EVERY SEAT, WITH ITS SIGNATURE.
 *
 * `EngineRoutingCell` (`entities.ts:259-269`) carries `approved_by`,
 * `approved_at` and `evidence_url` on every row, and all three are drawn. That
 * is the shape of the rule: "Routing is per jurisdiction × section cell; every
 * change is human-approved with evidence." A seat table without the approver
 * and the evidence would render the configuration and drop the accountability,
 * which is the half that makes the other half legitimate.
 *
 * ══ `approved_at` IS PASSED THROUGH UNTOUCHED ══════════════════════════════
 *
 * `shared/date.ts` is emphatic and `check-rules.mjs` enforces it: a date the
 * server sent is a date the server sent — not parsed, not normalised, not
 * re-rendered in a locale. `new Date("…")` parses as UTC midnight and renders a
 * day early west of Greenwich, and there is no formatter in this codebase for
 * exactly that reason. The ISO string is printed in mono, as data.
 *
 * ══ `evidence_url` IS PRINTED, NOT ANCHORED ════════════════════════════════
 *
 * The values in this deployment read `bench://run-41` — a scheme no browser can
 * follow. An anchor over it would be a dead link where a reader expects
 * evidence, which is worse than a citation they can go and look up. It renders
 * as the mono reference it is.
 *
 * ══ NO "PROMOTE" COLUMN ════════════════════════════════════════════════════
 *
 * There is no per-row action, no suggestion, and no marking of the row whose
 * engine scored best elsewhere. AGENTS.md bans auto-tuning, and a one-click
 * promote beside a score is auto-tuning with a human's finger on it: the
 * evidence would be the layout rather than a cited run. The change is made in
 * `SeatChange`, which will not file without a `seat`, an `engine_id` and an
 * `evidence_url` typed on purpose.
 */
export function SeatTable({ cells }: { readonly cells: readonly EngineRoutingCell[] }) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-line-strong bg-surface-panel">
      <Table
        label="Engine seat assignments"
        rows={cells}
        columns={SEAT_COLUMNS}
        rowKey={(cell) => cell.id}
        empty={
          <Empty
            title="No seats assigned"
            reason="Routing returned no cells. Nothing on this screen filters them — this is the server's whole answer."
          />
        }
      />
    </div>
  );
}

/** Mono: every value in this table is an identifier, a timestamp or a citation. */
function Ref({ children }: { readonly children: string }) {
  return (
    <span className="truncate font-mono text-meta leading-close text-ink-secondary">
      {children}
    </span>
  );
}

const SEAT_COLUMNS: TableColumn<EngineRoutingCell>[] = [
  {
    id: "jurisdiction",
    header: "Jurisdiction",
    width: "minmax(0,1fr)",
    cell: (cell) => <Ref>{cell.jurisdiction}</Ref>,
  },
  {
    id: "section",
    header: "Section",
    width: "minmax(0,1.1fr)",
    cell: (cell) => <Ref>{cell.section}</Ref>,
  },
  { id: "seat", header: "Seat", width: "minmax(0,0.5fr)", cell: (cell) => <Ref>{cell.seat}</Ref> },
  {
    id: "engine",
    header: "Engine seated",
    width: "minmax(0,1.4fr)",
    cell: (cell) => (
      <span className="truncate font-mono text-meta leading-close font-semibold text-ink-primary">
        {cell.engine_id}
      </span>
    ),
  },
  {
    id: "approved_by",
    header: "Approved by",
    width: "minmax(0,1fr)",
    cell: (cell) => <Ref>{cell.approved_by}</Ref>,
  },
  {
    id: "approved_at",
    header: "Approved at",
    width: "minmax(0,1.5fr)",
    cell: (cell) => <Ref>{cell.approved_at}</Ref>,
  },
  {
    id: "evidence",
    header: "Evidence",
    width: "minmax(0,1.2fr)",
    cell: (cell) => <Ref>{cell.evidence_url}</Ref>,
  },
];
