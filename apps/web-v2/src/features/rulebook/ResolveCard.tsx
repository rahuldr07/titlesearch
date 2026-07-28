import { Button } from "../../shared/ui/Button";
import { Eyebrow } from "../../shared/ui/Eyebrow";

const WHY =
  "No authority has been found for this question. Recording a ruling writes a new RULED rule citing the authority, which can then be confirmed; this entry stays as the record of the question.";

/**
 * OPEN · HOW THIS GETS RESOLVED.
 *
 * A rule tagged OPEN is a question nobody has answered yet, and CONTEXT §9 is
 * blunt about what that means: do not build past an OPEN. It can never be
 * confirmed, so a screen that offers only "Confirm → make LIVE" strands it —
 * the rule sits in the book forever with a button that will never work.
 *
 * THE CARD THAT SAYS SOMETHING IS UNRESOLVABLE MUST CARRY THE CONTROL THAT
 * RESOLVES IT. That is the whole reason this panel exists. Recording a ruling
 * writes a NEW rule with a citation; it does not edit this one, because the
 * open question is itself part of the record and answering it does not make it
 * never have been asked.
 *
 * WITHDRAW IS RESTRICTED, AND SAYS SO. Withdrawing an unresolved rule is an
 * engineer/admin act — a senior records the ruling, someone else takes the
 * entry out of the queue. The two roles are separated for the same reason
 * authoring and confirming are.
 *
 * CONTRACT GAP: `Rule` carries no provenance tag, so OPEN cannot be detected
 * from the wire; this panel is shown against the design's pending stage. There
 * is no ruling endpoint and no withdraw endpoint, so both controls are inert.
 */
export function ResolveCard({ mayWithdraw }: { mayWithdraw: boolean }) {
  return (
    <section
      data-testid="rule-resolve"
      className="rounded-9 border border-state-attend-border bg-state-attend-surface p-7"
    >
      <Eyebrow variant="caption" tone="attend" as="h3">
        OPEN · how this gets resolved
      </Eyebrow>

      <p className="mt-4 text-xs leading-open text-ink-secondary">{WHY}</p>

      <div className="mt-6 flex flex-wrap gap-4">
        <Button size="md" className="min-w-75 flex-1" disabled>
          Record a ruling →
        </Button>
        <Button size="md" fill="outlined" tone="halt" disabled={!mayWithdraw}>
          Withdraw unresolved
        </Button>
      </div>

      {mayWithdraw ? null : (
        <p className="mt-4 text-xs leading-body text-ink-muted">
          Withdrawing is restricted to engineer and admin — a senior records the
          ruling instead.
        </p>
      )}
    </section>
  );
}
