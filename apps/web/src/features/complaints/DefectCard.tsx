import type { Complaint } from "@titlepipe/contract";
import { Card, CardBody, CardHeader } from "../../components/ui";

/**
 * THE DEFECT RECORD: what the report shipped, and what the client says is of
 * record. The pair IS the complaint, which is why they sit side by side and
 * neither is drawn as the winner — the client is not automatically right, and
 * that is precisely why the loop ends in a rule rather than in an edit.
 *
 * ══ A NULL VALUE HERE IS NOT ONE OF THE FOUR NA STATES ═════════════════════
 *
 * Rule 14 types absence into four members and `NoValueChip` draws them. It is
 * NOT used here: `Complaint` (entities.ts:237-247) carries `shipped_value` and
 * `client_value` as bare nullable strings with NO `na_reason` beside them, so
 * stamping a side `NOT_FOUND` or `NOT_STATED` would be this screen inventing
 * the reason — the thing AGENTS.md forbids twice over ("never emit a value you
 * can't cite"). Each absence is stated in the words the record supports, and
 * the two sides say DIFFERENT things because a report that shipped nothing and
 * a client who named no value are different facts.
 */
export function DefectCard({ complaint }: { readonly complaint: Complaint }) {
  return (
    <Card padding="none">
      <CardHeader>
        <span>The defect</span>
        {/* Rule 3: an order ref is an identifier, so it is mono. */}
        <span className="font-mono text-label leading-flat text-ink-faint">
          {complaint.order_id}
        </span>
      </CardHeader>
      <CardBody className="flex flex-col gap-8">
        <p className="font-mono text-meta leading-close text-ink-secondary">
          {complaint.field_path}
        </p>
        <div className="grid grid-cols-2 gap-6">
          <Side
            label="Shipped in the report"
            value={complaint.shipped_value}
            absence="The report shipped no value here. The record does not say which absence."
          />
          <Side
            label="The client says"
            value={complaint.client_value}
            absence="The client named the field but stated no value of their own."
          />
        </div>
      </CardBody>
    </Card>
  );
}

function Side({
  label,
  value,
  absence,
}: {
  readonly label: string;
  readonly value: string | null;
  readonly absence: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-line-strong bg-surface-panel p-6">
      <span className="font-sans text-label leading-flat font-bold text-ink-muted">
        {label}
      </span>
      {value === null ? (
        <span className="font-sans text-meta leading-body text-ink-secondary">{absence}</span>
      ) : (
        <span className="font-mono text-body leading-close text-ink-primary">{value}</span>
      )}
    </div>
  );
}
