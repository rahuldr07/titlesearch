import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { CONFIRM_RESTRICTED } from "./refusalCopy";

/**
 * CONFIRM → MAKE LIVE. The act that turns a written rule into an applied one.
 *
 * THE FORWARD-ONLY SENTENCE IS NOT FINE PRINT. Confirming a rule does not
 * re-open delivered reports and does not change an order already in flight, and
 * that is the single most consequential fact about this button. Someone who
 * believes confirmation retroactively fixes past reports will confirm to fix a
 * complaint — and then wonder why the complaint is still there. Stating it
 * beside the button is cheaper than the phone call.
 *
 * A BLOCKED CONFIRM EXPLAINS ITSELF IN WORDS, never by a dead button. The
 * design's own note on this is that the reason names the control that unblocks
 * it, and never a direction ("below") that a later reorder turns into a lie.
 *
 * THE AFFORDANCE IS ABSENT FOR NON-HOLDERS, not disabled — the same rule the
 * account tab follows. `canDo` is the table the server gates with, so the
 * button cannot appear for someone the server would refuse; the reason text
 * takes its place so the screen is not silently missing a control.
 *
 * The server's refusal renders verbatim. A 409 is an ANSWER — "rule is not
 * pending" means somebody confirmed it while this screen was open, and
 * paraphrasing that into "something went wrong" throws away the only useful
 * part of it.
 */
export function ConfirmBlock({
  mayConfirm,
  pending,
  error,
  onConfirm,
}: {
  mayConfirm: boolean;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
}) {
  return (
    <section data-testid="rule-confirm" className="border-t border-line-subtle pt-7">
      {/*
        The reason wears the halt GROUND and the halt HAIRLINE as one pair,
        which is what `Card`'s tone axis is for: this block was hand-spelled,
        and the sibling that says the same thing about retiring was spelled a
        third way. Two drawings of one refusal teach a reader that the two
        refusals differ.
      */}
      {mayConfirm ? null : (
        <Card
          size="nested"
          tone="halt"
          className="mb-5 px-6 py-5 text-sm leading-body text-state-halt-ink"
        >
          {CONFIRM_RESTRICTED}
        </Card>
      )}

      <p className="mb-5 text-xs leading-body text-ink-muted">
        Confirming applies this rule only to orders processed{" "}
        <span className="font-semibold text-ink-secondary">after</span> it goes live. It
        never re-opens delivered reports and never changes an order mid-flight.
      </p>

      {mayConfirm ? (
        <Button
          size="xl"
          data-testid="rule-confirm-btn"
          disabled={pending}
          onClick={onConfirm}
        >
          Confirm → make LIVE
        </Button>
      ) : null}

      {error === null ? null : (
        <p
          role="alert"
          data-testid="rule-confirm-error"
          className="mt-4 text-xs font-semibold text-state-halt-ink"
        >
          server: {error}
        </p>
      )}
    </section>
  );
}
