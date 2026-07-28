import { Button } from "../../shared/ui/Button";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { NOT_WIRED, RETIRE_IMPACT } from "./designFixture";

/**
 * RETIRE IMPACT PREVIEW · WHAT REVERTS.
 *
 * Retiring a rule is not "stop doing this" — it is "go back to whatever the
 * pipeline did before this rule existed", and that is a different, larger
 * statement. Forty-one golden orders reverting to silent on an instrument is
 * the kind of thing you only see if somebody runs the preview and puts it in
 * front of you.
 *
 * RETIRING WITHOUT A PREVIEW IS PERMITTED, AND RECORDED. This is the deliberate
 * refusal to build a hard gate: blocking retirement on a preview would mean a
 * broken rule cannot be pulled when the preview service is down. Instead the
 * screen says the effect is unknown and the record shows it went out without
 * one — the operator keeps the power and the audit keeps the receipt.
 *
 * FORWARD-ONLY, SAME AS CONFIRMATION. Delivered reports and in-flight orders
 * are untouched. Symmetry matters here: if retirement were retroactive and
 * confirmation were not, nobody could hold both rules in their head.
 *
 * CONTRACT GAP: no retire endpoint exists, so the confirm control is inert; the
 * figures are the design's and are captioned as such.
 */
export function RetireConfirm({ onCancel }: { onCancel: () => void }) {
  return (
    <div
      data-testid="retire-confirm"
      className="rounded-9 border border-state-halt-border bg-state-halt-surface p-7"
    >
      <Eyebrow variant="caption" tone="halt" as="h3">
        Retire impact preview · what reverts
      </Eyebrow>

      <p className="mt-4 text-base leading-open text-ink-primary">
        <span className="font-mono font-semibold">{RETIRE_IMPACT.reverts}</span> of{" "}
        <span className="font-mono font-semibold">{RETIRE_IMPACT.total}</span> golden
        orders change if this stops applying.
      </p>
      <p className="mt-3 text-xs leading-body text-ink-secondary">{RETIRE_IMPACT.detail}</p>

      <p className="mt-5 rounded-6 border border-state-attend-border border-dashed bg-state-attend-surface px-5 py-3 text-xs leading-body text-state-attend-ink">
        {NOT_WIRED}
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
    </div>
  );
}
