import { useState } from "react";
import { Button } from "../../shared/ui/Button";
import { Card, CardBody } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { TextArea } from "../../shared/ui/TextField";

/**
 * Reopening a delivered order — the most consequential thing that can happen
 * after a sheet has gone out, so it is drawn as a confirmation, not a button.
 *
 * A REASON IS REQUIRED and the submit refuses without one. This is the same
 * refusal rule every correction in the product obeys: a change to a delivered
 * report with no stated cause is a change nobody can defend six months later,
 * when the only surviving artefact is "v2 exists". The reason is what makes the
 * version pair readable.
 *
 * The copy insists v1 "stays readable and is never edited" because that is the
 * question the person clicking this is actually asking. Reopening feels like
 * un-delivering; saying plainly that v1 is untouched and only the disputed
 * fields come back into play is what stops someone routing a dispute through a
 * whole re-review instead.
 *
 * `onSubmit` IS OPTIONAL AND ITS ABSENCE DISABLES THE ACTION. CONTRACT GAP:
 * nothing in the contract creates a v2 — there is no reopen endpoint — and the
 * server owns that transition, not the client (hard rule: server owns all state
 * machines). Rather than wire a click that silently does nothing, the missing
 * capability is expressed in the type: pass the mutation when it exists, and the
 * control turns on with no other change.
 *
 * THE ATTEND STRIPE IS `Card`'s ACCENT AXIS, not a severity edge. This panel is
 * the live block on a screen that is otherwise a receipt — "act here" — and the
 * 4px LEFT edge the design reserves for severity would put a reopen prompt in
 * the same visual class as a package that failed its gate. Spelling the stripe
 * by hand is how the two axes get confused, so it comes from the prop.
 */
export function ReopenPanel({
  orderId,
  onCancel,
  onSubmit,
}: {
  orderId: string;
  onCancel: () => void;
  onSubmit?: ((reason: string) => void) | undefined;
}) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const ready = trimmed.length > 0 && onSubmit !== undefined;

  return (
    <Card data-testid="reopen-panel" accent="attend" className="mb-10 text-left">
      <CardBody className="p-9">
        <Eyebrow
          variant="field"
          tone="attend"
          className="block text-tiny tracking-eyebrow"
        >
          Reopen for correction — creates v2
        </Eyebrow>

        <p className="mt-3 mb-6 text-md leading-open text-ink-secondary">
          A client dispute reopens order{" "}
          <span className="font-mono font-semibold text-ink-primary">{orderId}</span>.
          v1 stays readable and is never edited; only the disputed fields come back into
          play.
        </p>

        <TextArea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason for reopening (required) — e.g. client disputes the vested owner middle initial."
          aria-label="Reason for reopening"
          className="mb-6"
        />

        <div className="flex gap-4">
          <Button
            className="flex-1"
            disabled={!ready}
            onClick={() => {
              if (ready && onSubmit !== undefined) onSubmit(trimmed);
            }}
          >
            Create v2 &amp; reopen disputed fields
          </Button>
          <Button fill="outlined" tone="neutral" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
