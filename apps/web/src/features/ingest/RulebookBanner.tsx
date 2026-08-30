import { useRead } from "../../app/useRead";
import { clients as clientsRead } from "../../shared/clientsQueries";

/**
 * THE RULEBOOK BANNER — which resolved checklist applies to THIS order.
 *
 * ⚠ AMENDED 2026-08-29 (RULING-2026-08-29.md): `CreateOrderRequest` carries
 * `product` now, so the banner resolves by client AND product — the full
 * `EffectiveChecklist` key (workspace.ts:121) — where it used to name every
 * checklist the client had for want of the second half. One key, one
 * checklist, or an honest sentence about the absence.
 *
 * THE THREE LAYERS ARE REAL; THE THREE COUNTS ARE NOT. `EffectiveLine
 * .application` (workspace.ts:110) carries the three ways a standard line can
 * land — applies / narrowed / excluded — so the lines are LISTED and nothing
 * is tallied. The resolution itself is never recomputed either —
 * workspace.ts:100-104 is explicit that two resolvers disagreeing is the
 * defect that ships a search missing a line somebody thought was covered.
 * `conflict` is a SERVER-DETECTED contradiction between two overrides,
 * printed verbatim.
 */
export function RulebookBanner(props: {
  readonly clientId: string;
  readonly productId: string;
}) {
  const clients = useRead(clientsRead);

  if (props.clientId === "" || props.productId === "") {
    return (
      <p
        data-testid="rulebook-banner-idle"
        className="rounded-md border border-line-strong bg-surface-sunken px-6 py-5 font-sans text-meta leading-body text-ink-muted"
      >
        Choose a client and a product, and the checklist that resolves for the
        pair is named here.
      </p>
    );
  }

  const checklist = clients.data?.effective.find(
    (candidate) =>
      candidate.client_id === props.clientId &&
      candidate.product_id === props.productId,
  );

  if (checklist === undefined) {
    return (
      <p
        data-testid="rulebook-banner-unresolved"
        className="rounded-md border border-state-attend-border bg-state-attend-surface px-6 py-5 font-sans text-meta leading-body text-state-attend"
      >
        The server has not resolved a checklist for this client and product.
        Nothing is assumed in its place.
      </p>
    );
  }

  return (
    <div
      data-testid="rulebook-banner"
      className="flex flex-col gap-4 rounded-md border border-line-strong bg-surface-sunken px-6 py-5"
    >
      <span className="font-mono text-label leading-flat text-ink-muted">
        {checklist.product_id}
      </span>
      <ul className="flex flex-col gap-3">
        {checklist.lines.map((line) => (
          <li
            key={line.line_id}
            data-testid="rulebook-line"
            data-application={line.application}
            className="flex items-baseline gap-4"
          >
            <span className="font-mono text-label leading-flat tabular-nums text-ink-faint">
              {line.n}
            </span>
            <span className="min-w-0 flex-1 truncate font-sans text-label leading-close text-ink-secondary">
              {line.label}
            </span>
            <span
              data-testid={`rulebook-layer-${line.application}`}
              className="rounded-pill border border-line-strong bg-surface-panel px-5 py-1 font-sans text-label leading-flat text-ink-muted"
            >
              {line.application}
            </span>
            {line.scope_note !== null && (
              <span className="font-sans text-label leading-close text-ink-muted">
                {line.scope_note}
              </span>
            )}
          </li>
        ))}
      </ul>
      {checklist.conflict !== null && (
        <p
          data-testid="rulebook-conflict"
          className="font-sans text-meta leading-body text-state-halt"
        >
          {checklist.conflict}
        </p>
      )}
    </div>
  );
}
