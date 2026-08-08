import type { Field, OrderSignoffLine } from "@titlepipe/contract";
import { DECISION_STATES } from "./reportSections";
import { Button } from "../../shared/ui/Button";

/**
 * THE BAR BETWEEN DECIDING AND READING — the design's `:908-914`, the last
 * thing under the decision queue and before the draft report starts. It sits
 * here, not inside the expanded decision card and not inside the report pane,
 * because finalizing is an order-level act that follows every field decision
 * rather than belonging to any one of them.
 *
 * IT IS A DOCKED BAR, NOT A CARD. `flex:0 0 auto` on the pane's own column with
 * a single rule above and below it, so it never scrolls away from the queue
 * whose state it reports. A card here would float a bordered box between two
 * bands of the same pane and read as a third piece of content.
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
  const pendingCount = decisions.filter(
    (field) => field.state === "needs_review",
  ).length;
  const openNo = signoffLines.filter((line) => line.answer === "NO").length;
  const ready = pendingCount === 0 && openNo === 0;

  const parts: string[] = [];
  if (pendingCount > 0)
    parts.push(`${pendingCount} decision${pendingCount === 1 ? "" : "s"}`);
  if (openNo > 0) parts.push(`${openNo} NO disclosure${openNo === 1 ? "" : "s"}`);

  const note = ready
    ? "All decisions and disclosures resolved. Ready to render and deliver."
    : `${parts.join(" and ")} still need you. Finalize stays disabled until each is resolved.`;

  return (
    <div
      data-testid="finalize-bar"
      className="flex flex-none flex-wrap items-center gap-6 border-b border-line-strong bg-surface-raised px-9 py-5"
    >
      <span className="text-sm font-semibold text-ink-primary">Finalize</span>
      <span
        data-testid="finalize-note"
        className="min-w-0 flex-1 text-xs text-ink-secondary"
      >
        {note}
      </span>
      <Button size="md" data-testid="finalize-order-btn" disabled>
        Finalize order
      </Button>
    </div>
  );
}
