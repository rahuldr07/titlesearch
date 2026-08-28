import { useSignedIn } from "../../app/session/signedIn";
import { usePermissions } from "../../app/session/permissions";
import { Card } from "../../components/ui";
import { PanelFrame } from "./AccountPanel";
import { QueryState } from "../../entities/state/QueryState";
import { GrantList } from "./GrantList";

/**

 * ACCESS (RBAC) — this role's projection, read-only, and the prototype's matrix

 * refused twice over. `reference-app.html` draws a `1.5fr repeat(4,1fr)` grid: every

 * module against every one of four roles, cells reading — / VIEW / EDIT, and…

 */
export function AccessPanel() {
  const account = useSignedIn((s) => s.account);
  const permissions = usePermissions(account !== null);

  return (
    <PanelFrame
      title="Access control (RBAC)"
      note="What this seat may open and do, as the server projected it."
    >
      <QueryState query={permissions} of="the permission projection">
        {(data) => {
          const doors = data.rules.filter((rule) => rule.path !== undefined);
          const actions = data.rules.filter((rule) => rule.path === undefined);
          return (
            <div className="flex flex-col gap-8">
              <Card padding="tight">
                <div className="flex flex-col gap-2">
                  <span className="text-label font-semibold leading-flat text-ink-faint">
                    Projected for
                  </span>
                  {/* Rule 3: a role is an identifier the server gates on. */}
                  <span className="font-mono text-subject font-semibold leading-flat text-ink-primary">
                    {data.role}
                  </span>
                </div>
              </Card>

              <GrantList
                heading="Doors"
                note="A screen-entry grant guards its route prefix, so everything beneath it is covered by one row."
                items={doors.map((rule) => ({
                  key: rule.action,
                  name: rule.action,
                  detail: rule.path ?? null,
                }))}
              />

              <GrantList
                heading="Actions"
                note="Some carry a state guard the server evaluates. It is not read here — a client that pre-empted it would be re-deriving a state machine."
                items={actions.map((rule) => ({
                  key: rule.action,
                  name: rule.action,
                  detail: null,
                }))}
              />

              <p className="text-meta leading-body text-ink-secondary">
                One column, not four, and no cell cycles. The design draws every role
                against every module with editable cells; this payload is this
                role&rsquo;s world with the others unrepresented rather than hidden, and{" "}
                <code className="font-mono text-label">PERMISSIONS</code> is frozen at
                compile time (authz.ts:118) — there is no write to enable or to disable.
              </p>
            </div>
          );
        }}
      </QueryState>
    </PanelFrame>
  );
}
