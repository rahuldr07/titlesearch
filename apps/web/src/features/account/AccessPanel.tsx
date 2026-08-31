import { useSignedIn } from "../../app/session/signedIn";
import { usePermissions, hasAction } from "../../app/session/permissions";
import { useRead } from "../../app/useRead";
import { rbacMatrix } from "../../shared/accountQueries";
import { Card } from "../../components/ui";
import { PanelFrame } from "./AccountPanel";
import { QueryState } from "../../entities/state/QueryState";
import { useCycleRbac } from "./useSettings";
import { ModuleRows } from "./MatrixCells";

/**
 * Access (RBAC) — the full matrix, and its cells cycle. `GET /api/rbac`
 * serves the matrix and `PATCH /api/rbac` cycles one cell server-side: the
 * click posts the cell and the pane repaints from the server's answer. The
 * Admin column arrives `locked` and refuses in the server's words. A seat
 * without `rbac.edit` sees the matrix read-only under the amber banner —
 * visible, not absent.
 */
export function AccessPanel() {
  const account = useSignedIn((s) => s.account);
  const permissions = usePermissions(account !== null);
  const matrix = useRead(rbacMatrix);
  const { cycle, pending } = useCycleRbac();
  const mayEdit = hasAction(permissions.data?.rules, "rbac.edit");

  return (
    <PanelFrame
      title="Access control (RBAC)"
      note="Click a cell to cycle permissions: — → VIEW → EDIT. Rows marked live are enforced in this prototype."
    >
      <QueryState query={matrix} of="the access matrix">
        {(data) => {
          const modules = [...new Set(data.rows.map((row) => row.module))];
          return (
            <div className="flex flex-col gap-8">
              {!mayEdit && (
                <p
                  data-testid="rbac-readonly-banner"
                  className="rounded-md border border-state-attend-border bg-state-attend-surface px-7 py-4 font-sans text-meta leading-body text-state-attend"
                >
                  Read-only — RBAC grants this seat VIEW access to settings.
                  Role changes and cell edits are disabled.
                </p>
              )}
              <Card padding="none">
                <div
                  data-testid="rbac-matrix"
                  className="grid grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))] items-center gap-x-6 px-12 py-8"
                >
                  <span className="border-b border-ink-primary pb-4 font-sans text-label leading-flat font-semibold text-ink-muted">
                    Module / sub-module
                  </span>
                  {data.roles.map((role) => (
                    <span
                      key={role}
                      className="border-b border-ink-primary pb-4 font-sans text-label leading-flat font-semibold text-ink-muted"
                    >
                      {role}
                    </span>
                  ))}
                  {modules.map((module) => (
                    <ModuleRows
                      key={module}
                      rows={data.rows.filter((row) => row.module === module)}
                      module={module}
                      mayEdit={mayEdit}
                      pending={pending}
                      onCycle={cycle}
                    />
                  ))}
                </div>
              </Card>
            </div>
          );
        }}
      </QueryState>
    </PanelFrame>
  );
}
