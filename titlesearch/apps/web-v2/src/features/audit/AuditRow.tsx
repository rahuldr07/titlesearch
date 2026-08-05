import type { AuditEntry } from "@titlepipe/contract";
import { ListRow } from "../../shared/ui/ListRow";
import { formatRecordingDate } from "../../shared/date";
import { actionPhrase } from "./actionLabels";

/**
 * One line of the record: when, who, what, and to which thing.
 *
 * THE TIMESTAMP LEADS, in mono, in a fixed-width column. The question this
 * screen answers is "who amended that claim" — and the way anybody actually
 * finds it is by scanning down a time column to the moment they remember.
 * A ragged left edge makes that a reading exercise instead of a glance.
 *
 * THE ROW READS AS A SENTENCE, and the raw token stays. RULE: the record is
 * read by admins, not by the people who named its vocabulary. FAILURE
 * PREVENTED: the row used to say "M. Estrada · golden_correction" in mono, so
 * the screen that exists to answer "who amended that claim" answered it in the
 * server's log format and the reader had to translate. The phrase now leads in
 * regular-weight body after the bold actor name, exactly as the design writes
 * it, and `entry.action` is repeated verbatim in mono on the sub-line — so the
 * string somebody greps for in the server's logs is still on screen. Adding a
 * sentence, never substituting one, is what keeps both readers served.
 *
 * THE ENTITY REFERENCE IS LABELLED. "engine_routing rt_B_hartford-ct" ran two
 * different facts together as one token; an order says "Order 4176034-1" the
 * way the design does, and anything else names its kind first. Formatting only —
 * no value here is computed, and none is invented.
 *
 * CONTRACT GAP: `AuditEntry` carries id, actor_id, action, entity, entity_id
 * and at. The design's row also shows the EVIDENCE the act rested on ("p3
 * citation", "impact 9/9 golden") — the part that makes the record worth
 * keeping — and an `actor_name`, so a row can stop attributing an act to a
 * login handle. Neither is on the wire. The row omits the evidence rather than
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
          {actionPhrase(entry.action)}
        </span>
        <span className="mt-1 block text-xs text-ink-muted">
          {referenceOf(entry)} · <span className="font-mono">{entry.action}</span>
        </span>
      </span>
    </ListRow>
  );
}

/**
 * "Order 4176034-1" for an order-scoped act, "rules · rule_tax_vintage" for
 * everything else. The design labels the reference on every row; `entity` is
 * only sometimes an order, so the label follows what the server said the thing
 * was rather than asserting an order on rows that touched none.
 */
function referenceOf(entry: AuditEntry): string {
  return entry.entity === "orders"
    ? `Order ${entry.entity_id}`
    : `${entry.entity} · ${entry.entity_id}`;
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
