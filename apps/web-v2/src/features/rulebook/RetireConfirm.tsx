import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * RETIRE IMPACT PREVIEW · WHAT REVERTS.
 *
 * Retiring a rule is not "stop doing this" — it is "go back to whatever the
 * pipeline did before this rule existed", and that is a different, larger
 * statement. The design draws two states here: a preview that ran, showing
 * how many golden orders would change, and one that never ran, saying so
 * plainly instead of a blank gap.
 *
 * THIS RENDER IS ALWAYS THE "NO PREVIEW" STATE, AND THAT IS DELIBERATE, NOT AN
 * OMISSION. `Rule` carries no impact figures and no endpoint has ever run one
 * — there is no wire signal that could ever make a real rule take the other
 * branch. Showing invented "N of 50 golden orders" numbers here would be
 * exactly the uncited value principle 6 exists to prevent; the only render
 * that is true of every rule this screen can ever show is the absence one.
 * The design's `hasRetireImpact` branch (and the R-0142 fixture numbers that
 * used to stand in for it) is retired along with this decision — flag it in
 * review if a future preview endpoint changes the premise.
 *
 * RETIRING WITHOUT A PREVIEW IS PERMITTED, AND RECORDED. This is the design's
 * own refusal to build a hard gate: blocking retirement on a preview would
 * mean a broken rule cannot be pulled when the preview service is down.
 * Instead the screen says the effect is unknown and the record shows it went
 * out without a preview — the operator keeps the power and the audit keeps
 * the receipt.
 *
 * FORWARD-ONLY, SAME AS CONFIRMATION. Delivered reports and in-flight orders
 * are untouched. Symmetry matters here: if retirement were retroactive and
 * confirmation were not, nobody could hold both rules in their head.
 *
 * CONTRACT GAP: no retire endpoint exists, so the confirm control is inert.
 *
 * HALT AS A TONE, NOT AS AN ALARM STRIPE. This is the last thing between a
 * person and an irreversible-in-practice act, so the whole block is tinted;
 * it is not `accent`, which marks the live block on a screen and would put
 * this card in the same visual class as a step someone is merely on.
 */
export function RetireConfirm({ onCancel }: { onCancel: () => void }) {
  return (
    <Card tone="halt" data-testid="retire-confirm" className="p-7">
      <Eyebrow variant="caption" tone="halt" as="h3">
        Retire impact preview · what reverts
      </Eyebrow>

      <p data-testid="retire-preview" className="mt-4 text-sm leading-open text-ink-primary">
        No retire preview has been run for this rule, so what reverts is
        unknown. Retiring is still permitted — the record will show it went
        out without a preview.
      </p>

      <p className="mt-5 text-xs leading-body text-ink-muted">
        Retiring applies only to orders processed{" "}
        <span className="font-semibold text-ink-secondary">after</span> it retires.
        Delivered reports and in-flight orders are untouched.
      </p>

      <div className="mt-5 flex flex-wrap gap-4">
        <Button size="md" tone="halt" className="flex-1" disabled>
          Confirm → RETIRE
        </Button>
        <Button size="md" fill="outlined" tone="neutral" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
