import { Button } from "../../shared/ui/Button";

interface DecisionActionsProps {
  /** R13 suppression is offered where party identity is the question. */
  offerExclude: boolean;
  onConfirm: () => void;
  onCorrect: () => void;
  onEscalate: () => void;
  onExclude: () => void;
  onPass: () => void;
}

/**
 * The four things a reviewer can do to a field, plus the one they can do to the
 * order.
 *
 * FOUR, NOT THREE. Confirm and correct and escalate leave no way to say "this
 * row is not ours" — and a judgment hit against a different M. Quenby is
 * exactly that. Correcting it would file a suppression as a value change;
 * escalating it would ask a senior a question the reviewer has already
 * answered. Rulebook R13 names the action, so the screen offers it.
 *
 * They are ABSENT for roles that cannot act, never disabled. A greyed decision
 * is an invitation to ask for permission; an absent one is an answer.
 *
 * THE KEY HINTS ARE THE DESIGN'S LEGEND — `C confirm · E correct` (2026-07-28).
 * The letters are literal capitals in the markup, never a CSS transform, so a
 * screen reader announces "C" and not "see". Escalate carries NO key: an
 * accidental keystroke must never send a senior a question, so it is a button
 * only (`useReviewKeys` binds no `e`-to-escalate).
 */

/**
 * The confirm button's DOM id, so the blank refusal can point a screen reader at
 * the control it is about (`ReviewEditors`' `RefusalNudge`). A `data-testid` is
 * for the test runner and carries no meaning to assistive tech, which is why the
 * id is a second, separate attribute rather than a reuse of that one.
 *
 * It lives beside the button it names, not as a literal in the other file: the
 * two are a pair, and a pair spelled twice is a pair that drifts the first time
 * either side is renamed. Threading it as a prop would cross three components
 * that have no other reason to know about it.
 */
/* eslint-disable-next-line react-refresh/only-export-components -- an id constant, not a second component; the alternative is a duplicated string literal in ReviewEditors.tsx, which is the drift this export exists to prevent. */
export const CONFIRM_CONTROL_ID = "review-act-confirm";
export function DecisionActions({
  offerExclude,
  onConfirm,
  onCorrect,
  onEscalate,
  onExclude,
  onPass,
}: DecisionActionsProps) {
  return (
    <div className="flex flex-wrap gap-4">
      <Button size="sm" id={CONFIRM_CONTROL_ID} data-testid="act-confirm" onClick={onConfirm}>
        Confirm C
      </Button>
      <Button size="sm" fill="outlined" tone="neutral" data-testid="act-correct" onClick={onCorrect}>
        Correct E
      </Button>
      <Button size="sm" fill="outlined" tone="attend" data-testid="act-escalate" onClick={onEscalate}>
        ↗ Can&rsquo;t decide — escalate
      </Button>
      {offerExclude ? (
        <Button size="sm" fill="outlined" tone="halt" data-testid="act-exclude" onClick={onExclude}>
          ✕ Not our party
        </Button>
      ) : null}
      <Button size="sm" fill="ghost" tone="neutral" data-testid="act-pass" onClick={onPass}>
        Pass — say why
      </Button>
    </div>
  );
}
