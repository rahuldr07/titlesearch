import { useQuery } from "@tanstack/react-query";
import { auditQuery } from "./queries";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { formatRecordingDate } from "../../shared/date";

/**
 * The audit log: READ-ONLY AND APPEND-ONLY.
 *
 * `account.spec` #3 asserts there are NO inputs and NO textareas on this
 * screen — not disabled ones, none at all. An audit you can filter with a
 * free-text box is an audit someone can be talked into narrowing; an audit you
 * can edit is not an audit. So there is no search, no filter, no export, and
 * nothing to type into.
 *
 * Timestamps go through shared/date.ts. `new Date(entry.at)` here would be the
 * §8 trap in the one place where being a day out is least noticeable and most
 * consequential — an audit entry is evidence about when something happened.
 */
export function AuditTab() {
  const { data, isPending, isError } = useQuery(auditQuery);

  if (isError) return <p className="text-base text-state-halt-ink">Audit unavailable.</p>;
  if (isPending) return <p className="text-base text-ink-secondary">Loading the audit log…</p>;

  return (
    <Card>
      <CardHeader filled>
        <Eyebrow variant="section">Audit</Eyebrow>
        <span className="ml-auto text-xs text-ink-muted">
          Append-only. Nothing here can be edited or removed.
        </span>
      </CardHeader>
      <CardBody className="p-0">
        <ul>
          {data.entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-baseline gap-6 border-t border-line-subtle px-8 py-5 first:border-t-0"
            >
              <span className="font-mono text-base font-semibold text-ink-primary">
                {entry.action}
              </span>
              <span className="text-base text-ink-secondary">{entry.actor_id}</span>
              <span className="font-mono text-xs text-ink-muted">
                {entry.entity}/{entry.entity_id}
              </span>
              <span className="ml-auto font-mono text-xs text-ink-muted">
                {formatRecordingDate(entry.at.slice(0, 10)) ?? entry.at}
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
