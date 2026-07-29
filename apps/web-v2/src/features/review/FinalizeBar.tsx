import type { Field, OrderSignoffLine } from "@titlepipe/contract";
import { Card, CardBody } from "../../shared/ui/Card";
import { Button } from "../../shared/ui/Button";

const DECISION_STATES = new Set<Field["state"]>([
  "needs_review",
  "confirmed",
  "corrected",
  "escalated",
]);

/**
 * THE BAR BETWEEN DECIDING AND READING — the design's `:908-914`, the last
 * thing under the decision queue and before the draft report starts. It sits
 * here, not inside the expanded decision card and not inside the report pane,
 * because finalizing is an order-level act that follows every field decision
 * rather than belonging to any one of them.
 *
 * THE GATE IS TWO THINGS, NOT ONE — `finalizeEnabled = allAnswered && openNo
 * === 0` (design `:3227`). Watching only `Field.state` let this bar read "All
 * decisions answered" while an unresolved NO-disclosure card sat right above
 * the report; the design blocks on both counts for the same reason, and the
 * note names both when either is nonzero, never just the decisions.
 *
 * EVERY NO LINE COUNTS AS OPEN. `NoDisclosureCards` has no "resolved" render —
 * the design's accept/escalate resolution has no server-side counterpart, so
 * every NO line this screen can ever show is, honestly, still open. `pendingCount`
 * is the same tally `DecisionDock` shows, filtered straight off `Field.state`,
 * nothing re-derived — the two surfaces would drift apart if this one invented
 * its own count of "done".
 *
 * CONTRACT GAP: no finalize or deliver endpoint exists — `GET /api/deliveries`
 * is the only delivery resource in the contract, and there is no
 * `POST /api/orders/{id}/finalize`. The button is drawn as the design draws
 * it and stays disabled regardless of readiness; this is not a decision to
 * withhold finalize, it is the absence of anywhere to send it.
 */
export function FinalizeBar({
  fields,
  signoffLines,
}: {
  fields: readonly Field[];
  signoffLines: readonly OrderSignoffLine[];
}) {
  const decisions = fields.filter((field) => DECISION_STATES.has(field.state));
  const pendingCount = decisions.filter((field) => field.state === "needs_review").length;
  const openNo = signoffLines.filter((line) => line.answer === "NO").length;
  const ready = pendingCount === 0 && openNo === 0;

  const parts: string[] = [];
  if (pendingCount > 0) parts.push(`${pendingCount} decision${pendingCount === 1 ? "" : "s"}`);
  if (openNo > 0) parts.push(`${openNo} NO disclosure${openNo === 1 ? "" : "s"}`);

  const note = ready
    ? "All decisions and disclosures resolved. Ready to render and deliver."
    : `${parts.join(" and ")} still need you. Finalize stays disabled until each is resolved.`;

  return (
    <Card data-testid="finalize-bar">
      <CardBody className="flex flex-wrap items-center gap-6">
        <span className="text-sm font-semibold text-ink-primary">Finalize</span>
        <span data-testid="finalize-note" className="flex-1 text-xs text-ink-secondary">
          {note}
        </span>
        <Button size="md" data-testid="finalize-order-btn" disabled>
          Finalize order
        </Button>
      </CardBody>
    </Card>
  );
}
