import type { Complaint, HowItGotThrough } from "@titlepipe/contract";
import { Card, CardBody, CardHeader, Empty, cx } from "../../components/ui";

/**
 * THE INBOX, GROUPED BY HOW IT GOT THROUGH — which is the point of the screen.
 *
 * `enums.ts:96-98`, verbatim: "Complaint triage axis. `auto_confirmed` = no
 * human saw it = the threshold is wrong, not a reviewer. This grouping is the
 * point of the complaints screen." So the axis is not a filter control the
 * reader may switch off, and it is not a column: it is the structure, and the
 * two headings carry the reading the enum comment states.
 *
 * There is no other axis. No priority, no assignee, no age, no sort — the
 * `Complaint` shape (entities.ts:237-247) carries none of them and must not
 * grow one, for the same reason `INVARIANTS:39` keeps triage furniture off the
 * escalation inbox. The order within a group is the SERVER's array order,
 * printed.
 *
 * ══ RESOLVED IS READ OFF `rule_id`, NOT OFF `resolution` ═══════════════════
 *
 * The complaint loop terminates in a RULE (`endpoints.ts:548`). A complaint
 * carrying a resolution and no rule is not closed — it is a fix somebody typed
 * — and reading the state off the prose field would draw it as done. Same
 * reading `EscalationQueue` takes for the same rule.
 *
 * Rule 6: one status signal per row. The signal is the ◆ mark plus weight on an
 * open complaint. No capsule — this is a list, not a moment of record.
 */
const GROUPS: readonly {
  readonly id: HowItGotThrough;
  readonly title: string;
  readonly note: string;
}[] = [
  {
    id: "auto_confirmed",
    title: "Auto-confirmed — no human saw it",
    note: "The threshold is wrong, not a reviewer (enums.ts:96).",
  },
  {
    id: "human_confirmed",
    title: "Human-confirmed — a reviewer saw it and passed it",
    note: "The rulebook did not answer the question the reviewer was asking.",
  },
];

export function ComplaintList({
  complaints,
  selectedId,
  onSelect,
}: {
  readonly complaints: readonly Complaint[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-10">
      {GROUPS.map((group) => {
        const rows = complaints.filter((c) => c.how_it_got_through === group.id);
        return (
          <Card key={group.id} padding="none">
            <CardHeader>{group.title}</CardHeader>
            <CardBody className="flex flex-col gap-0 p-0">
              <p className="border-b border-line-subtle px-10 py-6 font-sans text-meta leading-body text-ink-secondary">
                {group.note}
              </p>
              {rows.length === 0 ? (
                <Empty
                  title="Nothing in this group"
                  reason="No delivered field reached a client this way — which is the outcome, not a missing read."
                />
              ) : (
                rows.map((complaint) => (
                  <ComplaintRow
                    key={complaint.id}
                    complaint={complaint}
                    selected={complaint.id === selectedId}
                    onSelect={onSelect}
                  />
                ))
              )}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

function ComplaintRow({
  complaint,
  selected,
  onSelect,
}: {
  readonly complaint: Complaint;
  readonly selected: boolean;
  readonly onSelect: (id: string) => void;
}) {
  const closed = complaint.rule_id !== null;
  return (
    <button
      type="button"
      data-testid={`complaint-${complaint.id}`}
      data-field-path={complaint.field_path}
      data-closed-by-rule={closed}
      aria-current={selected}
      onClick={() => onSelect(complaint.id)}
      className={cx(
        "tp-state flex cursor-pointer flex-col gap-3 border-b border-line-subtle px-10 py-8 text-left",
        "last:border-b-0 hover:bg-row-hover",
        selected && "bg-surface-sunken",
      )}
    >
      {/* Rule 3: a field path and an order ref are identifiers, so both are mono. */}
      <span className="font-mono text-label leading-flat text-ink-muted">
        {complaint.field_path}
      </span>
      <span
        className={cx(
          "font-sans text-meta leading-close text-ink-primary",
          !closed && "font-semibold",
        )}
      >
        <span aria-hidden className="pr-3 text-ink-muted">
          {closed ? "" : "◆"}
        </span>
        {closed ? "Closed on a rule" : "Open — no rule yet"}
      </span>
      <span className="font-mono text-label leading-flat text-ink-faint">
        {complaint.order_id}
      </span>
    </button>
  );
}
