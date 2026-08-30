import { useRead } from "../../app/useRead";
import { audit } from "../../shared/accountQueries";
import { Card } from "../../components/ui";
import { PanelFrame } from "./AccountPanel";
import { QueryState } from "../../entities/state/QueryState";

/**

 * AUDIT LOG — append-only, and read-only BY CONSTRUCTION. `endpoints.ts:575-576`

 * states it as a property of the contract rather than a permission: "the append-only

 * view (CONTEXT §6 audit_log).

 */
export function AuditPanel() {
  const log = useRead(audit);

  return (
    <PanelFrame
      title="Audit log"
      note="The append-only record, and it appends LIVE: a release, reissue, countersign, ruling, template save or access change files its row server-side the moment it happens (RULED 2026-08-29). There is no write endpoint in the contract, ever — and no filter, so a missing row means a missing event."
    >
      <QueryState query={log} of="the audit log">
        {(data) =>
          data.entries.length === 0 ? (
            <Card>
              <p className="text-meta leading-body text-ink-secondary">
                The log is empty. Nothing has been recorded against this tenant yet —
                this is the server&rsquo;s answer, not a filter with no matches.
              </p>
            </Card>
          ) : (
            <Card padding="none">
              <ul>
                {data.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-6 border-b border-line-subtle px-12 py-8 last:border-b-0"
                  >
                    <div className="flex min-w-0 flex-col gap-2">
                      <span className="truncate font-mono text-meta font-semibold leading-close text-ink-primary">
                        {entry.action}
                      </span>
                      <span className="truncate font-mono text-label leading-flat text-ink-muted">
                        {entry.entity} · {entry.entity_id}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="font-mono text-label leading-flat text-ink-secondary">
                        {entry.actor_id}
                      </span>
                      <span className="font-mono text-label leading-flat text-ink-faint">
                        {entry.at}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )
        }
      </QueryState>
    </PanelFrame>
  );
}
