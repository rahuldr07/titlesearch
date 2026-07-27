import { Button } from "../../shared/ui/Button";

/**
 * The reviewer's actions on one field.
 *
 * THERE IS NO BULK ACTION HERE AND THERE NEVER WILL BE. Hard constraint 6 says
 * approve-all, bulk-confirm and accept-remaining must not exist as components —
 * not disabled, not hidden behind a permission: absent. This bar takes a single
 * field and offers exactly the four decisions a person can make about it.
 *
 * NO OPTIMISTIC UPDATE. Constraint 10 and `review-conflict.spec` (3 INVARIANTs):
 * the server's returned state is the truth, a 409 is an ANSWER that renders,
 * and selection does not advance on a refusal. So these handlers report intent
 * upward and this component renders nothing about the outcome — it cannot,
 * because it does not know it yet.
 *
 * Correct and Escalate open a required-comment step rather than submitting:
 * a correction needs its reason (`review.spec` #4) and an escalation needs its
 * question (`review.spec` #6). Both are refusals, and both must say why.
 *
 * Keys are rendered as bare mono text, not as key-caps — the design has no
 * key-cap component and styling one here would invent a primitive.
 */
export function DecisionBar({
  onConfirm,
  onCorrect,
  onEscalate,
  onNotOurParty,
  /** Identity fields only — excluding a judgment that belongs to another person. */
  canExclude = false,
  disabled = false,
}: {
  onConfirm: () => void;
  onCorrect: () => void;
  onEscalate: () => void;
  onNotOurParty?: (() => void) | undefined;
  canExclude?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        <Button tone="settled" fill="outlined" onClick={onConfirm} disabled={disabled}>
          ✓ Confirm as read
        </Button>
        <Button tone="action" fill="outlined" onClick={onCorrect} disabled={disabled}>
          ✎ Correct it
        </Button>
        <Button tone="attend" fill="outlined" onClick={onEscalate} disabled={disabled}>
          ↗ Can&rsquo;t decide — escalate
        </Button>
        {canExclude && onNotOurParty ? (
          <Button tone="neutral" fill="outlined" onClick={onNotOurParty} disabled={disabled}>
            ✕ Not our party
          </Button>
        ) : null}
      </div>

      <p className="text-xs text-ink-secondary">
        Keys: <span className="font-mono">C</span> confirm ·{" "}
        <span className="font-mono">E</span> correct ·{" "}
        <span className="font-mono">N</span> not our party ·{" "}
        <span className="font-mono">J</span>/<span className="font-mono">K</span> move
      </p>
    </div>
  );
}
