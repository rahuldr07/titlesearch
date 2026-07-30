import type { AuditEntry } from "@titlepipe/contract";
import { ListRow } from "../../shared/ui/ListRow";
import { formatRecordingDate } from "../../shared/date";

/**
 * One line of the record: when, who, what, and to which thing.
 *
 * THE TIMESTAMP LEADS, in mono, in a fixed-width column. The question this
 * screen answers is "who amended that claim" — and the way anybody actually
 * finds it is by scanning down a time column to the moment they remember.
 * A ragged left edge makes that a reading exercise instead of a glance.
 *
 * THE ACTION NAME IS RENDERED VERBATIM, in mono, exactly as the server wrote
 * it. `golden_correction` is the server's vocabulary and the same token appears
 * in its logs; prettifying it to "Golden correction" would mean the string
 * somebody greps for is not the string the screen shows.
 *
 * CONTRACT GAP: `AuditEntry` carries id, actor_id, action, entity, entity_id
 * and at. The design's row also shows the order number and the EVIDENCE the act
 * rested on ("p3 citation", "impact 9/9 golden") — the part that makes the
 * record worth keeping. Neither is on the wire: `entity` / `entity_id` name the
 * thing touched, which is not always an order, and there is no evidence field
 * at all. The row shows the entity reference and omits the evidence rather than
 * captioning an empty slot on six rows out of six.
 */
export function AuditRow({ entry }: { entry: AuditEntry }) {
  return (
    <ListRow
      data-testid={`audit-${entry.id}`}
      className="flex flex-wrap items-start gap-7"
    >
      <span className="min-w-75 font-mono text-xs text-ink-muted">{whenOf(entry.at)}</span>

      <span className="min-w-100 flex-1">
        <span className="block text-base text-ink-primary">
          <span className="font-semibold">{entry.actor_id}</span> ·{" "}
          <span className="font-mono">{entry.action}</span>
        </span>
        <span className="mt-1 block text-xs text-ink-muted">
          {entry.entity} {entry.entity_id}
        </span>
      </span>
    </ListRow>
  );
}

/**
 * `2026-07-12T09:41:00Z` → `07/12/2026 09:41 UTC`.
 *
 * The date half goes through the audited formatter — the one place allowed to
 * touch date formatting — because an audit row rendered a day early in any
 * negative-offset timezone is a defect in the record itself. The time half is a
 * plain slice of the same string: no parsing, no `Date`, therefore no timezone
 * to get wrong. The zone is printed rather than converted, so the reader is
 * never guessing which clock the row is on.
 *
 * A timestamp we cannot read falls back to the raw string. A raw ISO string is
 * visibly odd; a silently shifted one is not.
 */
function whenOf(at: string): string {
  const date = formatRecordingDate(at.slice(0, 10));
  if (date === null || at.charAt(10) !== "T") return at;
  return `${date} ${at.slice(11, 16)} UTC`;
}
