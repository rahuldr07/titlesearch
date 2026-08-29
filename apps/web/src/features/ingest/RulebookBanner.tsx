import { useRead } from "../../app/useRead";
import { clients as clientsRead } from "../../shared/clientsQueries";

/**
 * THE RULEBOOK BANNER. It states which rulebook applies and does not pretend to
 * know whether the package cleared.
 *
 * THE DESIGN'S AMBER→GREEN FLIP IS NOT BUILT: it is driven by the quarantine
 * gateway passing, and there is no quarantine shape (ANALYSIS-screens.md §7
 * conversation 3). A banner that turned green on an event the client invented
 * would be the clearest possible version of the browser deciding a server
 * state.
 *
 * THE THREE LAYERS ARE REAL; THE THREE COUNTS ARE NOT. `EffectiveChecklist`
 * (workspace.ts:118) is the resolved checklist for one client against one
 * product and `EffectiveLine.application` (workspace.ts:107) carries the three
 * ways a standard line can land — applies / narrowed / excluded. So the lines
 * are LISTED and nothing is tallied. A first draft drew the design's chips as
 * `lines.filter(...).length` per application: no endpoint serves that census,
 * nothing else in the product could reconcile against it, and rule 11 wants one
 * variable rather than a second literal (`QueueBand.count` and
 * `LifecycleStage.count` are server-supplied for exactly this reason).
 *
 * The resolution itself is never recomputed either — workspace.ts:100-104 is
 * explicit that two resolvers disagreeing is the defect that ships a search
 * missing a line somebody thought was covered. `conflict` is a SERVER-DETECTED
 * contradiction between two overrides (workspace.ts:120), printed verbatim.
 */
export function RulebookBanner(props: { readonly clientId: string }) {
  const clients = useRead(clientsRead);

  if (props.clientId === "") {
    return (
      <p
        data-testid="rulebook-banner-idle"
        className="rounded-md border border-line-strong bg-surface-sunken px-6 py-5 font-sans text-meta leading-body text-ink-muted"
      >
        Choose a client and the rulebook that applies to this order is named
        here.
      </p>
    );
  }

  const resolved = clients.data?.effective.filter(
    (checklist) => checklist.client_id === props.clientId,
  );

  if (resolved === undefined || resolved.length === 0) {
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
    <div data-testid="rulebook-banner" className="flex flex-col gap-5">
      {resolved.map((checklist) => (
        <div
          key={`${checklist.client_id}:${checklist.product_id}`}
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
      ))}
    </div>
  );
}
