import { useQuery } from "@tanstack/react-query";
import { ClientsResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";

/**
 * THE RULEBOOK BANNER (design §Screens 5: "rulebook banner — amber until
 * quarantine passes, then green with 3 layer chips").
 *
 * ══ THE TRAFFIC LIGHT IS NOT BUILT; THE LAYERS ARE ═════════════════════════
 *
 * The design's amber→green flip is driven by the quarantine gateway passing,
 * and there is no quarantine shape (ANALYSIS-screens.md §7 conversation 3).
 * A banner that turned green on an event the client invented would be the
 * clearest possible version of the browser deciding a server state, so the
 * flip is absent — the banner states which rulebook applies and does not
 * pretend to know whether the package cleared.
 *
 * ══ THE THREE LAYERS ARE REAL; THE THREE COUNTS ARE NOT ═══════════════════
 *
 * The design's "3 layer chips" have no named shape, but the layering they
 * describe does exist and is served: `EffectiveChecklist` (workspace.ts:118)
 * is the resolved checklist for one client against one product, and
 * `EffectiveLine.application` (workspace.ts:107) carries the three ways a
 * standard line can land — applies / narrowed / excluded.
 *
 * SO THE LINES ARE LISTED AND NOTHING IS TALLIED. A first draft of this
 * component drew the design's chips as `lines.filter(...).length` per
 * application, and that is a count authored in a browser: no endpoint serves
 * it, nothing else in the product could be reconciled against it, and rule 11
 * wants one variable rather than a second literal. `QueueBand.count` and
 * `LifecycleStage.count` are both server-supplied for precisely this reason
 * (endpoints.ts:124, intake.ts:220). A layer census is a legitimate thing to
 * WANT — it is added to the backend conversation, not computed here.
 *
 * The resolution itself is likewise never recomputed: workspace.ts:100-104 is
 * explicit that two resolvers disagreeing is the defect that ships a search
 * missing a line somebody thought was covered.
 *
 * `conflict` is a SERVER-DETECTED contradiction between two overrides
 * (workspace.ts:120) and is printed verbatim when present.
 */
export function RulebookBanner(props: { readonly clientId: string }) {
  const clients = useQuery({
    queryKey: ["clients"],
    queryFn: () => get("/api/clients", ClientsResponse),
  });

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
