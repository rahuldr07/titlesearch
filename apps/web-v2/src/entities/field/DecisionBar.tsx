import { Button } from "../../shared/ui/Button";

/**
 * The reviewer's actions on ONE field, in the export's own words.
 *
 * THE COPY IS THE DESIGN'S, RECOVERED. The live bar read `Confirm C` /
 * `Correct E` — the key legend welded onto the button label, in a screen that
 * already prints that legend once in the queue header. The export says
 * `✓ Confirm as read` and `✎ Correct it`: what the act DOES, not which key
 * fires it. A label that names its shortcut stops being a label the moment the
 * shortcut moves, and this one had already moved once (⏎ → `c`).
 *
 * THERE IS NO BULK ACTION HERE AND THERE NEVER WILL BE. Approve-all,
 * bulk-confirm and accept-remaining are ABSENT as components — not disabled,
 * not permission-gated (HANDOFF §4.4).
 *
 * `✕ Not our party` IS OFFERED ONLY WHERE PARTY IDENTITY IS THE QUESTION
 * (rulebook R13). Correcting a judgment against a different M. Quenby would
 * file a suppression as a value change; escalating it would ask a senior a
 * question the reviewer has already answered.
 *
 * CORRECT AND ESCALATE OPEN A REQUIRED-COMMENT STEP rather than submitting: a
 * correction needs its reason (`review.spec` #4), an escalation needs its
 * question (`review.spec` #6). Both are refusals, and both must say why.
 *
 * NO OPTIMISTIC UPDATE. These handlers report intent upward and this component
 * renders nothing about the outcome — it cannot, because it does not know it
 * yet, and a 409 is an ANSWER the server has to be allowed to give.
 *
 * CONTRACT GAP: the export gates escalate on `d.canEscalate` and swaps the
 * confirm label to `Claim is right` when the decision came from an intake
 * sign-off claim (`d.fromSignoff`). `Field` carries neither, so escalate is
 * always offered and the label is always the machine-read wording.
 */
/**
 * The confirm button's DOM id, so the blank refusal can point a screen reader
 * at the control it is about (`ReviewEditors`' `RefusalNudge`). A `data-testid`
 * is for the test runner and carries no meaning to assistive tech, which is why
 * the id is a second, separate attribute rather than a reuse of that one. It
 * lives beside the button it names: a pair spelled in two files is a pair that
 * drifts the first time either side is renamed.
 */
/* eslint-disable-next-line react-refresh/only-export-components -- an id constant, not a second component; the alternative is a duplicated string literal in ReviewEditors.tsx, which is the drift this export exists to prevent. */
export const CONFIRM_CONTROL_ID = "review-act-confirm";

export interface DecisionBarProps {
  /** R13 suppression is offered where party identity is the question. */
  offerExclude: boolean;
  onConfirm: () => void;
  onCorrect: () => void;
  onEscalate: () => void;
  onExclude: () => void;
  /** Order-level, and deliberately quiet — a pass is not a decision on a field. */
  onPass: () => void;
}

export function DecisionBar({
  offerExclude,
  onConfirm,
  onCorrect,
  onEscalate,
  onExclude,
  onPass,
}: DecisionBarProps) {
  return (
    <div className="flex flex-wrap gap-4">
      <Button
        size="sm"
        fill="outlined"
        tone="settled"
        id={CONFIRM_CONTROL_ID}
        data-testid="act-confirm"
        onClick={onConfirm}
      >
        ✓ Confirm as read
      </Button>
      <Button
        size="sm"
        fill="outlined"
        tone="action"
        data-testid="act-correct"
        onClick={onCorrect}
      >
        ✎ Correct it
      </Button>
      {offerExclude ? (
        <Button
          size="sm"
          fill="outlined"
          tone="neutral"
          data-testid="act-exclude"
          onClick={onExclude}
        >
          ✕ Not our party
        </Button>
      ) : null}
      <Button
        size="sm"
        fill="outlined"
        tone="attend"
        data-testid="act-escalate"
        onClick={onEscalate}
      >
        ↗ Can&rsquo;t decide — escalate
      </Button>
      <Button size="sm" fill="ghost" tone="neutral" data-testid="act-pass" onClick={onPass}>
        Pass — say why
      </Button>
    </div>
  );
}
