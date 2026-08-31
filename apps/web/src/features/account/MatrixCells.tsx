import type { RbacCell, RbacRow } from "@titlepipe/contract";
import { cx } from "../../components/ui";

/**
 * The matrix's row groups and cells. Every level shown is the server's; a
 * click posts the cell and the pane repaints from the server's answer.
 */
export function ModuleRows({
  module,
  rows,
  mayEdit,
  pending,
  onCycle,
}: {
  readonly module: string;
  readonly rows: readonly RbacRow[];
  readonly mayEdit: boolean;
  readonly pending: boolean;
  readonly onCycle: (rowId: string, role: string) => void;
}) {
  return (
    <>
      <span className="col-span-5 border-b border-line-subtle bg-surface-sunken px-2 py-3 font-sans text-meta leading-close font-semibold text-ink-secondary">
        {module}
      </span>
      {rows.map((row) => (
        <div key={row.id} className="col-span-5 grid grid-cols-subgrid items-center border-b border-line-subtle py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-sans text-meta leading-close font-medium text-ink-primary">
              {row.label}
              {row.live && (
                <span className="ml-3 rounded-pill bg-state-settled-surface px-3 py-1 font-sans text-label leading-flat font-bold text-state-settled">
                  live
                </span>
              )}
            </span>
            <span className="font-sans text-label leading-flat text-ink-muted">{row.note}</span>
          </div>
          {row.cells.map((cell) => (
            <MatrixCell
              key={cell.role}
              rowId={row.id}
              cell={cell}
              mayEdit={mayEdit}
              pending={pending}
              onCycle={onCycle}
            />
          ))}
        </div>
      ))}
    </>
  );
}

/** One cell — the server's level, cycled by the server on click, with the
 * hold stated when the click is refused before it is sent. */
function MatrixCell({
  rowId,
  cell,
  mayEdit,
  pending,
  onCycle,
}: {
  readonly rowId: string;
  readonly cell: RbacCell;
  readonly mayEdit: boolean;
  readonly pending: boolean;
  readonly onCycle: (rowId: string, role: string) => void;
}) {
  const held = cell.locked
    ? "The Admin column is locked — an admin's access is not editable here."
    : !mayEdit
      ? "Read-only — this seat lacks rbac.edit."
      : pending
        ? "Sending — the server has not answered yet."
        : null;
  return (
    <button
      type="button"
      data-testid={`rbac-${rowId}-${cell.role}`}
      data-level={cell.level}
      title={held ?? "Click to cycle — the server owns the order"}
      disabled={held !== null}
      onClick={() => onCycle(rowId, cell.role)}
      className={cx(
        "tp-state inline-flex h-9 w-fit min-w-24 items-center justify-center rounded-pill px-4 font-mono text-label leading-flat font-semibold",
        held === null ? "cursor-pointer" : "cursor-not-allowed",
        cell.level === "edit"
          ? "bg-state-settled-surface text-state-settled"
          : cell.level === "view"
            ? "bg-action-surface text-action"
            : "bg-surface-sunken text-ink-faint",
      )}
    >
      {cell.level === "edit" ? "EDIT" : cell.level === "view" ? "VIEW" : "—"}
    </button>
  );
}
