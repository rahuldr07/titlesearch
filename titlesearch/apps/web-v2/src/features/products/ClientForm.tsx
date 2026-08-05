import { Button } from "../../shared/ui/Button";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { TextField } from "../../shared/ui/TextField";

/**
 * Authoring a client RECORD — name, code, contact, and nothing else.
 *
 * Sign-off defaults and overrides are deliberately not on this form. They are
 * deltas against a product baseline, and a delta authored before you can see
 * what it differs from is a guess. Putting them here would also make creating a
 * client feel like a decision about how searches get answered, when it is only
 * an identifier: creating a client changes nothing until an order points at it.
 */
export function ClientForm({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow variant="field" as="label" htmlFor="client-name">Client name</Eyebrow>
        <TextField id="client-name" className="mt-3" />
      </div>

      <div>
        <Eyebrow variant="field" as="label" htmlFor="client-code">Code</Eyebrow>
        <TextField id="client-code" className="mt-3" placeholder="e.g. NWT" />
      </div>

      <div>
        <Eyebrow variant="field" as="label" htmlFor="client-contact">Contact</Eyebrow>
        <TextField id="client-contact" className="mt-3" placeholder="orders@example.com" />
      </div>

      <p className="text-xs leading-body text-ink-muted">
        Creating a client changes nothing until an order points at it. Sign-off
        defaults and overrides are set on the Clients screen.
      </p>

      {/* CONTRACT GAP: no endpoint accepts a client record. */}
      <div className="flex gap-4">
        <Button size="lg" block disabled data-testid="save-client">
          Save client
        </Button>
        <Button size="lg" fill="outlined" tone="neutral" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <p className="text-xs leading-body text-ink-muted">
        CONTRACT GAP: the clients endpoint reads only. Save is disabled rather
        than silently discarding what you typed.
      </p>
    </div>
  );
}
