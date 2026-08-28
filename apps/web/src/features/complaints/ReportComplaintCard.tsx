import { useState } from "react";
import { Button, Card, CardBody, CardHeader, Input, Label } from "../../components/ui";
import { reportHold } from "./complaintHold";

/**
 * FILING ONE. `POST /api/complaints` (endpoints.ts:509, `authz.ts:115`
 * `ops`/`admin`).
 *
 * ══ THE ORDER IS TYPED, NOT PICKED, AND THAT IS THE RULE ═══════════════════
 *
 * There is no order field with a dropdown behind it, because there is no
 * order-list endpoint anywhere in this product: `endpoints.ts:69` — "there is
 * no browse/pick endpoint" — and `INVARIANTS:22` states it as a refusal. A
 * complaint ARRIVES naming an order; the ref is transcribed from what the
 * client sent. A picker here would be the first line of a browse feature.
 *
 * ══ THE INPUTS ARE UNCONTROLLED, AND THE FORM RESETS BY REMOUNT ════════════
 *
 * `components/ui/input.tsx:43-46` Omit-s `value` and `defaultValue` on purpose,
 * so an `Input` cannot be driven from state and cannot be cleared by setting
 * one. The parent bumps a key on success and this whole card remounts, which
 * clears the DOM and this component's state in one act. That is also why the
 * local state below is write-only: it feeds the hold sentence, never the field.
 *
 * ══ THE DESCRIPTION FIELD IS DELIBERATELY ABSENT ═══════════════════════════
 *
 * `CreateComplaintRequest` accepts `description`, and `Complaint`
 * (entities.ts:237-247) has nowhere to read it back from — handlers.ts:1032
 * drops it. A box that swallows the client's own words and shows them to nobody
 * is worse than no box, so the gap is REPORTED (see `ComplaintDetail`) rather
 * than papered over with a control that appears to work.
 *
 * ══ RULE 1: THE ACCENT IS NOT SPENT HERE ═══════════════════════════════════
 *
 * Secondary, because the screen's one accent-dominant act is the RESOLUTION —
 * the rule that closes the loop. Recording a defect is the input to that
 * decision, not the decision.
 */
export function ReportComplaintCard({
  pending,
  onReport,
}: {
  readonly pending: boolean;
  readonly onReport: (order: string, path: string, clientValue: string | null) => void;
}) {
  const [order, setOrder] = useState("");
  const [path, setPath] = useState("");
  const [clientValue, setClientValue] = useState("");
  const held = reportHold(order, path);

  return (
    <Card padding="none">
      <CardHeader>Record a defect a client has reported</CardHeader>
      <CardBody className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <Label htmlFor="complaint-order">The delivered order it shipped on</Label>
          {/* Rule 3: an order ref is data, so the field is mono. */}
          <Input
            id="complaint-order"
            data-testid="complaint-order"
            data
            aria-label="The delivered order it shipped on"
            onChange={(event) => setOrder(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-4">
          <Label htmlFor="complaint-path">The field the client says is wrong</Label>
          <Input
            id="complaint-path"
            data-testid="complaint-path"
            data
            aria-label="The field the client says is wrong"
            onChange={(event) => setPath(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-4">
          <Label htmlFor="complaint-client-value">
            The value the client says is of record — optional
          </Label>
          <Input
            id="complaint-client-value"
            data-testid="complaint-client-value"
            data
            aria-label="The value the client says is of record"
            onChange={(event) => setClientValue(event.target.value)}
          />
          <p className="font-sans text-meta leading-body text-ink-secondary">
            Left empty when the client says the field is wrong without saying
            what it should be. That is a different record from a shipped blank,
            and both are kept.
          </p>
        </div>

        <Button
          data-testid="report-complaint-btn"
          variant="secondary"
          disabledBecause={pending ? "Sending — the server has not answered yet." : held}
          onPress={() =>
            onReport(order.trim(), path.trim(), clientValue.trim() === "" ? null : clientValue.trim())
          }
        >
          {held === null ? "File the complaint" : "File — held"}
        </Button>
      </CardBody>
    </Card>
  );
}
