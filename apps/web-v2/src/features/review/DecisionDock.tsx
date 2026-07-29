import type { Field } from "@titlepipe/contract";
import { isExcluded } from "./fieldLabel";
import { DECISION_STATES } from "./reportSections";
import { Card, CardBody } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { cn } from "../../shared/ui/classNames";

type SegmentTone = "pending" | "confirmed" | "corrected" | "escalated" | "excluded";

function toneOf(field: Field): SegmentTone {
  if (isExcluded(field)) return "excluded";
  if (field.state === "needs_review") return "pending";
  if (field.state === "confirmed") return "confirmed";
  if (field.state === "corrected") return "corrected";
  return "escalated";
}

const SEGMENT_CLASS: Record<SegmentTone, string> = {
  pending: "bg-line-strong",
  confirmed: "bg-state-settled",
  corrected: "bg-action",
  escalated: "bg-state-attend",
  excluded: "bg-state-settled",
};

/**
 * THE DECISION QUEUE'S OWN METER — answered-of-total, one segment per decision,
 * plus what is left. This is a count of finite work, never a rate: no clock,
 * no per-reviewer number, nothing that turns "how much is left" into "how fast
 * are you going" (HANDOFF §4.5).
 *
 * THE DENOMINATOR IS THE FIELDS THE PIPELINE FLAGGED, not every field on the
 * order. `auto_confirmed` fields were never a person's decision and do not
 * belong in either number — `state` says which is which, so this component
 * derives nothing the server did not already decide.
 *
 * "REST OF THE QUEUE" IS THIS ORDER'S QUEUE, NOT THE REVIEWER'S ORDER QUEUE.
 * The design's copy reads like the cross-order queue `/api/queue/next` walks,
 * but tracing the mock (`decRest = decisions.filter(d => !d.expanded)`, scoped
 * entirely to `D.decisions` for the current order) shows it counts this
 * order's OTHER flagged fields — the ones not currently open. That count is
 * fully sourced from `Field.state` here, same as the progress meter; it is
 * NOT the global next-order count and carries no CONTRACT GAP.
 *
 * THE KEY HINT NAMES THE KEYS THIS SCREEN ACTUALLY BINDS (`useReviewKeys`) —
 * `C confirm · E correct · j/k move`, the design's 2026-07-28 legend, now that
 * the screen adopts it. Escalate is absent from the hint because it has no
 * hotkey: it is a button (`act-escalate`). The letters are literal capitals in
 * the markup, not a CSS transform.
 */
export function DecisionDock({
  fields,
  selectedPath,
}: {
  fields: readonly Field[];
  selectedPath: string | null;
}) {
  const decisions = fields.filter((f) => DECISION_STATES.has(f.state));
  const needTotal = decisions.length;
  const answered = decisions.filter((f) => toneOf(f) !== "pending").length;
  const restOfQueue = decisions.filter((f) => f.path !== selectedPath).length;

  if (needTotal === 0) return null;

  return (
    <Card data-testid="decision-dock">
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline gap-4">
          <Eyebrow variant="section" tone="action">
            Decision queue
          </Eyebrow>
          <span className="text-xs text-ink-muted">
            {answered} of {needTotal} answered
          </span>
          <span className="ml-auto whitespace-nowrap text-tiny text-ink-muted">
            Confirm <span className="font-mono">C</span> · Correct{" "}
            <span className="font-mono">E</span> · Move{" "}
            <span className="font-mono">j</span>/<span className="font-mono">k</span>
          </span>
        </div>

        <div className="flex gap-1" role="img" aria-label={`${answered} of ${needTotal} decisions answered`}>
          {decisions.map((field) => (
            <span
              key={field.id}
              className={cn("h-2 flex-1 rounded-1", SEGMENT_CLASS[toneOf(field)])}
              title={`${field.path} — ${toneOf(field)}`}
            />
          ))}
        </div>

        <p className="text-xs font-semibold uppercase tracking-label text-ink-muted">
          Rest of the queue · {restOfQueue}
        </p>
      </CardBody>
    </Card>
  );
}
