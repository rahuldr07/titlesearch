import { useQuery } from "@tanstack/react-query";
import { ClientsResponse } from "@titlepipe/contract";
import { RadioGroup, RadioGroupItem } from "../../components/ui";
import { get } from "../../shared/api";

/**
 * THE CLIENT IS CHOSEN, NEVER TYPED.
 *
 * `client_id` is a `CreateOrderRequest` member (endpoints.ts:39) and the old
 * screen took it as free text. A mistyped id is a mistype away from resolving
 * the WRONG sign-off checklist, which is the one thing intake decides —
 * `EffectiveChecklist` (workspace.ts:118) is keyed on `client_id`, and a
 * search missing a line somebody thought was covered is the defect that
 * produces. `GET /api/clients` (workspace.ts:131) has always served the list,
 * so the screen asks rather than guesses.
 *
 * The rows are radios, not a combobox: the demo roster is short, and a
 * disclosure widget hides the one fact the operator is choosing between.
 * `code` renders in mono beside the name — it is a data key (rule 3), and it
 * is what the operator recognises from the county paperwork.
 *
 * ══ NO CLIENT IS PRE-SELECTED, AND THAT IS DELIBERATE ══════════════════════
 *
 * Defaulting to the first row would send an unexamined `client_id` on every
 * upload where the operator never looked at this control. The absence of a
 * choice must reach the server as an absence, so the SERVER names it in the
 * missing-field list (INVARIANTS 60-61) rather than the screen quietly
 * supplying one.
 */
export function ClientPicker(props: {
  readonly value: string;
  readonly onChange: (clientId: string) => void;
}) {
  const clients = useQuery({
    queryKey: ["clients"],
    queryFn: () => get("/api/clients", ClientsResponse),
  });

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
