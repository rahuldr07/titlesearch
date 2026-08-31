import type { Key } from "react-aria-components";
import { useRead } from "../../app/useRead";
import { usePermissions, hasAction } from "../../app/session/permissions";
import { useSignedIn } from "../../app/session/signedIn";
import { people, rbacMatrix } from "../../shared/accountQueries";
import { Badge, Card, Option, Select } from "../../components/ui";
import { PanelFrame } from "./AccountPanel";
import { QueryState } from "../../entities/state/QueryState";
import { useAssignRole } from "./useSettings";

/**
 * People — the roster, with the role picker. The picker's vocabulary is the
 * RBAC matrix's `roles` — served, so the pane offers only words the server
 * will accept. A seat without `person.role.assign` sees the picker disabled
 * with the reason; the server still refuses with 403 either way.
 */
export function PeoplePanel() {
  const roster = useRead(people);
  const matrix = useRead(rbacMatrix);
  const permissions = usePermissions(useSignedIn((s) => s.account !== null));
  const { assign, pending } = useAssignRole();

  const roles = matrix.data?.roles ?? [];
  const mayAssign = hasAction(permissions.data?.rules, "person.role.assign");
  const held = !mayAssign
    ? "Read-only — this seat lacks person.role.assign."
    : pending
      ? "Sending — the server has not answered yet."
      : null;

  return (
    <PanelFrame
      title="People & roles"
      note="Who holds a seat, and which of them are privileged without a second factor."
    >
      <QueryState query={roster} of="the roster">
        {(data) => (
          <div className="flex flex-col gap-8">
            <p className="text-meta leading-body text-ink-secondary">
              <span
                data-mfa-gap={data.privileged_without_mfa}
                className={
                  data.privileged_without_mfa > 0
                    ? "font-semibold text-state-attend"
                    : "font-semibold text-state-settled"
                }
              >
                {data.privileged_without_mfa} privileged without MFA
              </span>{" "}
              — the server&rsquo;s count across the whole shop, not a filter over the
              rows below. The roster is scoped to you; the gate is not.
            </p>

            <Card padding="none">
              <ul>
                {data.people.map((person) => (
                  <li
                    key={person.id}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] items-center gap-8 border-b border-line-subtle px-12 py-8 last:border-b-0"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="truncate text-meta font-semibold leading-close text-ink-primary">
                        {person.name}
                      </span>
                      {/* An address is an identifier, so it is mono. */}
                      <span className="truncate font-mono text-label leading-flat text-ink-muted">
                        {person.email}
                      </span>
                    </div>
                    {/* The served vocabulary, one PATCH per change, the
                        roster repainting from its own re-read. */}
                    <Select
                      label={`Role for ${person.name}`}
                      data-testid={`person-role-${person.id}`}
                      selectedKey={person.role}
                      disabledBecause={held}
                      onSelectionChange={(key: Key | null) => {
                        const next = key === null ? null : String(key);
                        if (next !== null && next !== person.role) assign(person.id, next);
                      }}
                    >
                      {(roles.includes(person.role) ? roles : [person.role, ...roles]).map(
                        (role) => (
                          <Option key={role} id={role}>
                            {role}
                          </Option>
                        ),
                      )}
                    </Select>
                    <span className="truncate text-label leading-flat text-ink-muted">
                      {person.status}
                    </span>
                    <div className="flex shrink-0 items-center gap-4">
                      {person.privileged && person.mfa !== "enrolled" && (
                        <Badge tone="attend">Privileged, no MFA</Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <p className="text-meta leading-body text-ink-secondary">
              A role change posts to the server and repaints from its answer —
              nothing here edits a row locally (RULED 2026-08-29; the picker is
              drawn, so it is built).
            </p>
          </div>
        )}
      </QueryState>
    </PanelFrame>
  );
}
