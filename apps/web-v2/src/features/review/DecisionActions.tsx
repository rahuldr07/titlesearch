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
 */
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
      <Button size="sm" data-testid="act-confirm" onClick={onConfirm}>
        Confirm ⏎
      </Button>
      <Button size="sm" fill="outlined" tone="neutral" data-testid="act-correct" onClick={onCorrect}>
        Correct c
      </Button>
      <Button size="sm" fill="outlined" tone="attend" data-testid="act-escalate" onClick={onEscalate}>
        Escalate e
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
