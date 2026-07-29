import type { Field } from "@titlepipe/contract";
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
 * THE NOTE NAMES WHAT IS LEFT, NEVER A READINESS VERDICT. `needTotal` and
 * `answered` are the same tally `DecisionDock` already shows — filtered
 * straight off `Field.state`, nothing re-derived — because the two surfaces
 * would drift apart if this one invented its own count of "done".
 *
 * CONTRACT GAP: no finalize or deliver endpoint exists — `GET /api/deliveries`
 * is the only delivery resource in the contract, and there is no
 * `POST /api/orders/{id}/finalize`. The button is drawn as the design draws
 * it and stays disabled; this is not a decision to withhold finalize, it is
 * the absence of anywhere to send it.
 */
export function FinalizeBar({ fields }: { fields: readonly Field[] }) {
  const decisions = fields.filter((field) => DECISION_STATES.has(field.state));
  const needTotal = decisions.length;
  const answered = decisions.filter((field) => field.state !== "needs_review").length;
  const remaining = needTotal - answered;

  const note =
    needTotal === 0
      ? "No decisions on this order."
      : remaining === 0
        ? `All ${needTotal} decisions answered. The report reflects your calls.`
        : `${remaining} of ${needTotal} decisions still open.`;

  return (
    <Card data-testid="finalize-bar">
      <CardBody className="flex flex-wrap items-center gap-6">
        <span className="text-sm font-semibold text-ink-primary">Finalize</span>
        <span className="flex-1 text-xs text-ink-secondary">{note}</span>
        <Button size="md" data-testid="finalize-order-btn" disabled>
          Finalize order
        </Button>
      </CardBody>
    </Card>
  );
}
