import type { ClientRecord } from "@titlepipe/contract";

import { Button } from "../../shared/ui/Button";

/**
 * Who this client is, and what may be done to the record itself.
 *
 * A REFUSAL NEEDS A REASON, AND A DISABLED BUTTON IS NOT ONE. Edit and Retire
 * stay visible and inert because the row's shape is what says those acts exist
 * at all — removing them would teach that a client record can never be changed.
 * But left unexplained a pair of dead controls reads as a broken screen rather
 * than as an endpoint nobody has built yet, so the reason is ON SCREEN here as
 * it already is under the products and lines panels. This roster was the one
 * place carrying it in a code comment only.
 *
 * CONTRACT GAP: `ClientRecord` carries no contact and no retired flag. The code
 * stands in for the contact the export prints — it is the identifier orders
 * actually arrive under — and nothing here draws a "Retired" badge, because the
 * schema cannot say either way and a badge nobody can cite is an invention.
 *
 * CONTRACT GAP: creating, editing and retiring a client are server writes with
 * no endpoint. `＋ New client` lives on the roster row above for the same
 * reason and is covered by the same note.
 */
export function ClientIdentity({
  client,
  canAuthor,
}: {
  client: ClientRecord;
  canAuthor: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-5">
        <p className="text-md">
          <span className="font-semibold text-ink-primary">{client.name}</span>{" "}
          <span className="font-mono text-ink-muted">· {client.code}</span>
        </p>
        {canAuthor ? (
          <span className="ml-auto flex gap-3">
            <Button size="sm" fill="outlined" tone="neutral" disabled>
              Edit client
            </Button>
            <Button
              size="sm"
              fill="outlined"
              tone="neutral"
              className="text-state-halt-ink"
              disabled
            >
              Retire
            </Button>
          </span>
        ) : null}
      </div>

      {canAuthor ? (
        <p className="text-xs leading-body text-ink-muted">
          CONTRACT GAP: the client roster is READ ONLY. Creating, editing and retiring a
          client are server writes with no endpoint.
        </p>
      ) : null}
    </div>
  );
}
