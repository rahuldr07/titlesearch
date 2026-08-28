import { useSignedIn } from "../../app/session/signedIn";
import { usePermissions } from "../../app/session/permissions";
import { Card } from "../../components/ui";
import { PanelFrame } from "./AccountPanel";
import { QueryState } from "../../entities/state/QueryState";
import { GrantList } from "./GrantList";

/**
 * ACCESS (RBAC) — this role's projection, read-only, and the prototype's matrix
 * refused twice over.
 *
 * `reference-app.html` draws a `1.5fr repeat(4,1fr)` grid: every module against
 * every one of four roles, cells reading — / VIEW / EDIT, and its own subtitle
 * says "Click a cell to cycle permissions: — → VIEW → EDIT."
 *
 * ══ REFUSAL 1: THERE IS NO CROSS-ROLE PAYLOAD, BY DESIGN ═══════════════════
 *
 * `GET /api/me/permissions` returns THIS role's projection "with holder lists
 * redacted — other worlds are unrepresented in it, not hidden"
 * (`app/session/permissions.ts:9-18`). That is INVARIANT 42/43 implemented on
 * the wire: a role-locked affordance is ABSENT, not disabled, and doors outside
 * your world are ABSENT, not dimmed.
 *
 * A four-column matrix needs all four roles' grants in one response. Building
 * it would mean either a new endpoint that serves every role's world to every
 * caller — which is the exact thing the redaction exists to prevent — or the
 * browser evaluating `PERMISSIONS` itself, which is INVARIANT 41: there is ONE
 * permission table and it is the server's, and "a second evaluation of the
 * table in the browser is a second table, and it drifts from the first at
 * exactly the moment a role changes."
 *
 * ══ REFUSAL 2: THE CELLS CANNOT CYCLE ══════════════════════════════════════
 *
 * `authz.ts:118` closes `PERMISSIONS` with `as const satisfies`. The table is
 * frozen at COMPILE time — it is not a row anybody can write, at any privilege,
 * through any endpoint. There is no write to disable, so no cell is drawn as a
 * disabled control: rule 9 wants a blocked control to state its reason, and a
 * dimmed cell would state the wrong one ("you may not" instead of "nothing
 * may").
 *
 * ══ WHAT IS DRAWN INSTEAD ══════════════════════════════════════════════════
 *
 * The one column the contract does serve: the doors and actions this role
 * holds, printed verbatim from the payload, split by whether the grant carries
 * a `path` (a door) or not (an action). Nothing is evaluated here — `hasDoor`
 * and `hasAction` are string comparisons for exactly this reason — and the
 * `when` guard is deliberately not interpreted, because it gates actions
 * against resource state and the server enforces it.
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
                One column, not four, and no cell cycles. The design draws every
                role against every module with editable cells; this payload is
                this role&rsquo;s world with the others unrepresented rather than
                hidden, and{" "}
                <code className="font-mono text-label">PERMISSIONS</code> is
                frozen at compile time (authz.ts:118) — there is no write to
                enable or to disable.
              </p>
            </div>
          );
        }}
      </QueryState>
    </PanelFrame>
  );
}
