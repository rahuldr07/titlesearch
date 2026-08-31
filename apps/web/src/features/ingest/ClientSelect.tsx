import type { Key } from "react-aria-components";
import { Option, Select } from "../../components/ui";
import { useRead } from "../../app/useRead";
import { clients as clientsRead } from "../../shared/clientsQueries";

/**
 * The client is chosen, never typed — a mistyped `client_id` resolves the
 * wrong sign-off checklist, which is the one thing intake decides. No client
 * is pre-selected: defaulting to the first row would send an unexamined
 * `client_id` on every sign where the operator never looked here, and the
 * absence must reach the server as an absence so the server names it.
 */
export function ClientSelect(props: {
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
    <div data-testid="client-select">
      <Select
        label="Client"
        placeholder="Choose the client…"
        selectedKey={props.value === "" ? null : props.value}
        onSelectionChange={(key: Key | null) =>
          props.onChange(key === null ? "" : String(key))
        }
      >
        {clients.data.clients.map((client) => (
          <Option key={client.id} id={client.id}>
            {/* The "(N sign-offs)" figure is the server's own, printed only
                when sent — never a browser tally. */}
            {client.sign_offs === undefined
              ? client.name
              : `${client.name} (${client.sign_offs})`}
          </Option>
        ))}
      </Select>
    </div>
  );
}
