import { RadioGroup, RadioGroupItem } from "../../components/ui";
import { useRead } from "../../app/useRead";
import { clients as clientsRead } from "../../shared/clientsQueries";

/**
 * THE CLIENT IS CHOSEN, NEVER TYPED. A mistyped `client_id` resolves the WRONG
 * sign-off checklist, which is the one thing intake decides —
 * `EffectiveChecklist` (workspace.ts:118) is keyed on it, and the defect that
 * produces is a search missing a line somebody thought was covered.
 * `GET /api/clients` (workspace.ts:131) serves the list, so the screen asks.
 *
 * Radios, not a combobox: the roster is short and a disclosure widget hides the
 * one fact the operator is choosing between. `code` is mono beside the name —
 * rule 3, and it is what the operator recognises from the county paperwork.
 *
 * NO CLIENT IS PRE-SELECTED. Defaulting to the first row would send an
 * unexamined `client_id` on every upload where the operator never looked here.
 * The absence must reach the server as an absence, so the SERVER names it in
 * the missing-field list (INVARIANTS 60-61).
 */
export function ClientPicker(props: {
  readonly value: string;
  readonly onChange: (clientId: string) => void;
}) {
  const clients = useRead(clientsRead);

  if (clients.data === undefined) {
    return (
      <p
        data-testid="client-picker-unread"
        className="font-sans text-meta leading-close text-ink-faint"
      >
        {clients.isError
          ? "The client roster could not be read. Nothing here may be typed in its place."
          : "Reading the client roster…"}
      </p>
    );
  }

  return (
    <RadioGroup
      aria-label="Client"
      value={props.value}
      onChange={props.onChange}
      className="grid grid-cols-2 gap-4"
    >
      {clients.data.clients.map((client) => (
        <RadioGroupItem
          key={client.id}
          value={client.id}
          data-testid={`choice-client-${client.id}`}
          className="rounded-md border border-line-strong bg-control-fill px-5 py-4"
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-sans text-meta leading-close text-ink-primary">
              {client.name}
            </span>
            <span className="font-mono text-label leading-flat text-ink-muted">
              {client.code}
            </span>
          </span>
        </RadioGroupItem>
      ))}
    </RadioGroup>
  );
}
