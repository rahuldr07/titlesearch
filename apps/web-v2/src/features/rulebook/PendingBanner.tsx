/**
 * THE SENTENCE THAT HAS TO BE READ BEFORE THE FIRST FIELD, not after the save
 * button: saving RECORDS a rule and enables nothing. An author who believes
 * they are switching extraction on writes a different rule from one who knows a
 * second person has to agree, and by the time the refusal appears the rule is
 * already written.
 *
 * IT IS NOT A `Card`. The tinted-block primitive draws a self-contained block
 * with its own hairline on four sides; this is the HEADER BAND of the dashed
 * form shell around it, and it owes that shell a single shared edge. Given a
 * card's own border it would read as a notice sitting inside the form rather
 * than as the form's own first statement — and the form's dashed 2px attend
 * edge is not a tone pair `Card` carries, so the two would not match anyway.
 *
 * Extracted from `NewRuleForm` when adopting the shared primitives pushed that
 * file past the 150-line limit: the banner is the one part of it that is a
 * claim about consequences rather than a control.
 */
export function PendingBanner() {
  return (
    <div className="flex items-center gap-6 border-b border-state-attend-border bg-state-attend-surface px-8 py-7">
      <span
        aria-hidden
        className="flex size-13 shrink-0 items-center justify-center rounded-pill bg-state-attend font-bold text-ink-on-action"
      >
        ◷
      </span>
      <div>
        {/* Literal capitals in the markup — a CSS transform does not change what the text SAYS. */}
        <p className="text-md font-bold tracking-badge text-state-attend-ink">
          PENDING — AFFECTS NOTHING YET
        </p>
        <p className="mt-1 text-xs leading-body text-state-attend-ink">
          Saving records this rule. It cannot change a report — confirmation is
          a separate act by an engineer or admin.
        </p>
      </div>
    </div>
  );
}
