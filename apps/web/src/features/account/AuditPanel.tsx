import { useRead } from "../../app/useRead";
import { audit } from "../../shared/accountQueries";
import { Card } from "../../components/ui";
import { PanelFrame } from "./AccountPanel";
import { PanelState } from "./PanelState";

/**
 * AUDIT LOG — append-only, and read-only BY CONSTRUCTION.
 *
 * `endpoints.ts:575-576` states it as a property of the contract rather than a
 * permission: "the append-only view (CONTEXT §6 audit_log). Read-only by
 * construction: there is no write endpoint in this contract, ever."
 *
 * So there is no filter chip row, no export, no date range and no resolve. The
 * prototype draws an `auditFilter`; a filter is defensible on a read (see
 * `RulesPanel` for where that line falls) but this list is the record that
 * every other screen's claims are checked against, and a filtered audit view is
 * the one place a missing row reads as an absent event rather than a hidden
 * one. It renders whole, newest first, as the server ordered it.
 *
 * ══ THE ROWS ARE NOT DECORATED ═════════════════════════════════════════════
 *
 * `AuditEntry` is `actor_id`, `action`, `entity`, `entity_id`, `at` — five
 * strings, four of which are identifiers, so four of them are mono (rule 3).
 * None is mapped to a friendlier word: `engine_seat_change` prints as
 * `engine_seat_change`, because a lookup table turning that into "Engine seat
 * changed" is client-side product copy for a server-owned vocabulary, and it
 * drifts the moment the pipeline adds a sixth action. The same argument
 * `LifecycleStamp.label` makes for staying a free string.
 *
 * `at` passes through untouched. §8 and `shared/date.ts`: "a date the server
 * sent is a date the server sent — it is not parsed, not normalised, not
 * re-rendered in a locale", because west of Greenwich a re-rendered recording
 * date moves by a day and changes which lien is senior.
 */
export function AuditPanel() {
  const log = useRead(audit);

  return (
    <PanelFrame
      title="Audit log"
      note="The append-only record. There is no write endpoint in the contract, ever — and no filter, so a missing row means a missing event."
    >
      <PanelState query={log} of="the audit log">
        {(data) =>
          data.entries.length === 0 ? (
            <Card>
              <p className="text-meta leading-body text-ink-secondary">
                The log is empty. Nothing has been recorded against this tenant
                yet — this is the server&rsquo;s answer, not a filter with no
                matches.
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
      </PanelState>
    </PanelFrame>
  );
}
