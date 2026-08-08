import { useQuery } from "@tanstack/react-query";
import { ChoiceCardGrid } from "../../shared/ui/ChoiceCardGrid";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { clientsQuery } from "./queries";

/**
 * WHICH CLIENT — the one thing intake decides.
 *
 * RULE: never emit a value you cannot cite. Every card here is a client the
 * server returned from `GET /api/clients`; the id submitted as `client_id` is
 * the server's own id, never a string somebody typed.
 *
 * FAILURE PREVENTED: a mistyped client id is accepted at the door and resolves
 * the WRONG effective sign-off list onto the order — the checklist is frozen at
 * intake, so the mistake surfaces as a line missing from a delivered search
 * weeks later, with nothing on the order to explain it.
 *
 * NOT LOADED IS NOT EMPTY. While the list is in flight this says so; it does
 * not render an empty grid, which would state that the client has no clients.
 * The failure line is `halt` and stays on screen — the upload button below is
 * deliberately still live, because §4.3 leaves the definition of a complete
 * order to the door and the door's refusal is the answer.
 */
export function ClientPicker({
  value,
  onSelect,
}: {
  value: string | null;
  onSelect: (id: string) => void;
}) {
  const clients = useQuery(clientsQuery);

  return (
    <fieldset className="flex flex-col gap-4">
      <Eyebrow as="legend" variant="field">
        CLIENT &middot; REQUIRED &middot; RESOLVES THE EFFECTIVE SIGN-OFF
      </Eyebrow>

      {clients.isError ? (
        <p role="alert" className="text-xs leading-body text-state-halt-ink">
          The client list could not be loaded, so no client can be chosen here. The door
          will refuse the package and name the field.
        </p>
      ) : clients.isPending ? (
        <p className="text-xs leading-body text-ink-secondary">Loading clients…</p>
      ) : (
        <ChoiceCardGrid
          name="client"
          columns={2}
          value={value}
          onSelect={onSelect}
          options={clients.data.clients.map((client) => ({
            id: client.id,
            title: client.name,
            sub: client.code,
          }))}
        />
      )}
    </fieldset>
  );
}
