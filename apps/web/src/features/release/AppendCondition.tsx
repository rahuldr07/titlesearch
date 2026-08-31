import { TextField } from "react-aria-components";
import { Button, Input } from "../../components/ui";

/**
 * The append-a-condition affordance, drawn and held. CONTRACT GAP: nothing on
 * the wire files a condition — no condition list, no POST. The control stands
 * and says why rather than vanishing: a text box that silently dropped what
 * was typed into it is how an examiner comes to believe a covenant is on a
 * report that never carried one.
 */
const HELD =
  "Held: no endpoint files a release condition. The manifest is composed server-side and carries no condition list, so anything typed here would go nowhere.";

export function AppendCondition() {
  return (
    <div
      data-testid="append-condition"
      className="flex flex-col gap-4 border-t border-page-line pt-8"
    >
      <div className="flex items-start gap-6">
        <TextField
          aria-label="Append a release condition or covenant"
          isDisabled
          className="flex-1"
        >
          <Input
            placeholder="Append a release condition or covenant"
            disabledBecause={HELD}
            data-testid="append-condition-input"
          />
        </TextField>
        <Button variant="secondary" disabledBecause={HELD} data-testid="append-condition-submit">
          Append
        </Button>
      </div>
      <p className="font-sans text-label leading-body text-ink-muted">{HELD}</p>
    </div>
  );
}
