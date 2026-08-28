import { useRead } from "../../app/useRead";
import { people } from "../../shared/accountQueries";
import { Badge, Card } from "../../components/ui";
import { PanelFrame } from "./AccountPanel";
import { PanelState } from "./PanelState";

/**
 * PEOPLE — the roster, read-only, and the role picker the prototype draws is
 * the thing that is refused.
 *
 * `reference-app.html`'s People pane, measured: a card at 24px padding, a
 * "Team Directory" 11px w600 cap, then rows on a
 * `160px 1fr 180px 100px` grid with a hairline between — name w600 ink, email
 * mono grey, a `<select>` of four roles, and a mono last-seen.
 *
 * ══ THE ROLE `<select>` IS A WRITE, AND THERE IS NO WRITE ══════════════════
 *
 * The prototype's third column changes a person's role on change. No endpoint
 * accepts one: `PeopleResponse` (`intake.ts:336`) is a read shape, there is no
 * `PATCH /api/people/{id}` in the contract, and `PERMISSIONS` closes with
 * `as const satisfies` (`authz.ts:118`) — the role table is compile-time
 * frozen, so a role a person could be moved to is not a runtime value at all.
 *
 * Rendering the select disabled would be the wrong refusal here. Rule 9 and
 * rule 12 want a blocked CONTROL to state its reason, but this is not a control
 * the reader is being denied — it is a control that does not exist in this
 * system. A disabled dropdown says "you may not"; the truth is "nothing may,
 * yet". So the role prints as a value and the pane says so once, in words.
 *
 * ══ `privileged_without_mfa` IS THE SERVER'S FIGURE ════════════════════════
 *
 * Never a filter over `people`. `intake.ts:330-334`: the roster is role-scoped
 * and the gate is not, so "a compliance count that falls as your permissions
 * narrow is a gate that looks satisfied when it is not." It is drawn from the
 * response's own member and nothing here counts rows.
 *
 * Whether it BLOCKS anything is open ruling Q16 and is explicitly not settled,
 * so it is stated and does not gate a single affordance on this screen.
 *
 * ══ THERE IS NO LAST-SEEN COLUMN ═══════════════════════════════════════════
 *
 * The prototype's fourth column is a mono timestamp per person. `Person`
 * (`intake.ts:319-327`) carries `id`, `name`, `email`, `role`, `privileged`,
 * `status` and `mfa`, and no activity field of any kind. `status` and `mfa` are
 * drawn in its place, which are the two facts the roster actually holds and the
 * two a compliance reader is looking for.
 */
export function PeoplePanel() {
  const roster = useRead(people);

  return (
    <PanelFrame
      title="People"
      note="Who holds a seat, and which of them are privileged without a second factor."
    >
      <PanelState query={roster} of="the roster">
        {(data) => (
          <div className="flex flex-col gap-8">
            {/*
             * The gate figure leads, because it is the only number on this pane
             * and the reason a compliance reader opens it.
             */}
            <Card padding="tight">
              <div className="flex items-center justify-between gap-8">
                <div className="flex flex-col gap-2">
                  <span className="text-label font-semibold leading-flat text-ink-faint">
                    Privileged without MFA
                  </span>
                  <span className="text-meta leading-close text-ink-secondary">
                    The server&rsquo;s count across the whole shop, not a filter
                    over the rows below — the roster is scoped to you and the
                    gate is not.
                  </span>
                </div>
                <span
                  data-mfa-gap={data.privileged_without_mfa}
                  className={
                    data.privileged_without_mfa > 0
                      ? "text-title font-bold leading-flat tabular-nums text-state-attend"
                      : "text-title font-bold leading-flat tabular-nums text-state-settled"
                  }
                >
                  {data.privileged_without_mfa}
                </span>
              </div>
            </Card>

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
              Read-only. The design puts a role picker on every row; no endpoint
              accepts a role change, and{" "}
              <code className="font-mono text-label">PERMISSIONS</code> closes
              with <code className="font-mono text-label">as const satisfies</code>{" "}
              (authz.ts:118), so the table is frozen at compile time rather than
              guarded at runtime.
            </p>
          </div>
        )}
      </PanelState>
    </PanelFrame>
  );
}
