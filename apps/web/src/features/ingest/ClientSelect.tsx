import type { Key } from "react-aria-components";
import { Option, Select } from "../../components/ui";
import { useRead } from "../../app/useRead";
import { clients as clientsRead } from "../../shared/clientsQueries";

/**
 * THE CLIENT IS CHOSEN, NEVER TYPED. A mistyped `client_id` resolves the WRONG
 * sign-off checklist, which is the one thing intake decides. `GET /api/clients`
 * (workspace.ts:131) serves the roster, so the screen asks.
 *
 * ⚠ RULED 2026-08-29 (RULING-2026-08-29.md): the reference draws a SELECT with
 * a per-client sign-off figure — "Mortgage Connect (14 sign-offs)" — so the
 * house radio-card picker gave way to the drawn control, and the figure is the
 * server's own `sign_offs` (ClientRecord, finished string), printed only when
 * sent.
 *
 * NO CLIENT IS PRE-SELECTED. Defaulting to the first row would send an
 * unexamined `client_id` on every sign where the operator never looked here.
 * The absence must reach the server as an absence, so the SERVER names it in
 * the missing-field list (INVARIANTS 60-61).
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
                when sent — never a browser tally (RULING-2026-08-29). */}
            {client.sign_offs === undefined
              ? client.name
              : `${client.name} (${client.sign_offs})`}
          </Option>
        ))}
      </Select>
    </div>
  );
}
