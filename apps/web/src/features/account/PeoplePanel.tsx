import { useRead } from "../../app/useRead";
import { people } from "../../shared/accountQueries";
import { Badge, Card } from "../../components/ui";
import { PanelFrame } from "./AccountPanel";
import { QueryState } from "../../entities/state/QueryState";

/**

 * PEOPLE — the roster, read-only, and the role picker the prototype draws is the thing

 * that is refused. `reference-app.html`'s People pane, measured: a card at 24px

 * padding, a "Team Directory" 11px w600 cap, then rows on a `160px 1fr…

 */
export function PeoplePanel() {
  const roster = useRead(people);

  return (
    <PanelFrame
      title="People & roles"
      note="Who holds a seat, and which of them are privileged without a second factor."
    >
      <QueryState query={roster} of="the roster">
        {(data) => (
          <div className="flex flex-col gap-8">
            {/*
             * ONE LINE, NOT A CARD. The design leads with the Team Directory
             * and has no gate card at all; an earlier pass here put
             * `privileged_without_mfa` in a card that took the first read off
             * the roster. The figure stays — it is the server's, and it is why
             * a compliance reader opens this pane — but it sits under the
             * heading rather than above the thing it is about.
             */}
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
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] items-center gap-8 border-b border-line-subtle px-12 py-8 last:border-b-0"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="truncate text-meta font-semibold leading-close text-ink-primary">
                        {person.name}
                      </span>
                      <span className="text-label leading-flat text-ink-faint">
                        {person.role}
                      </span>
                    </div>
                    {/* Rule 3: an address is an identifier, so it is mono. */}
                    <span className="truncate font-mono text-meta leading-close text-ink-muted">
                      {person.email}
                    </span>
                    <div className="flex shrink-0 items-center gap-4">
                      {person.privileged && person.mfa !== "enrolled" && (
                        <Badge tone="attend">Privileged, no MFA</Badge>
                      )}
                      <span className="text-label leading-flat text-ink-muted">
                        {person.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <p className="text-meta leading-body text-ink-secondary">
              Read-only. The design puts a role picker on every row; no endpoint accepts
              a role change, and{" "}
              <code className="font-mono text-label">PERMISSIONS</code> closes with{" "}
              <code className="font-mono text-label">as const satisfies</code>{" "}
              (authz.ts:118), so the table is frozen at compile time rather than guarded
              at runtime.
            </p>
          </div>
        )}
      </QueryState>
    </PanelFrame>
  );
}
