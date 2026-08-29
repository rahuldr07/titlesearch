import type { QuarantineResponse } from "@titlepipe/contract";
import { useRead } from "../../app/useRead";
import { clients as clientsRead } from "../../shared/clientsQueries";
import { QuarantineGate } from "./QuarantineGate";

/**
 * THE RULEBOOK BANNER. It states which rulebook applies, and whether the
 * package cleared quarantine — in the server's words for both.
 *
 * THE AMBER→GREEN FLIP IS BUILT, AND IT IS THE SERVER'S (README §22: "amber
 * until quarantine passes, then green"). An earlier version refused the flip on
 * the ground that no quarantine shape existed; that premise died with the
 * 2026-08-28 ruling — `QuarantineResponse` (design2.ts:35-42) carries a server
 * state per step, and `QuarantineGate` renders those states and nothing else.
 * On the form stage no order exists yet, so `quarantine` is null and the strip
 * is amber with THAT as the stated reason — true either way, which is the
 * point.
 *
 * THE THREE LAYERS ARE REAL; THE THREE COUNTS ARE NOT. `EffectiveChecklist`
 * (workspace.ts:121) is the resolved checklist for one client against one
 * product and `EffectiveLine.application` (workspace.ts:110) carries the three
 * ways a standard line can land — applies / narrowed / excluded. So the lines
 * are LISTED and nothing is tallied: no endpoint serves that census, and rule
 * 11 wants one variable rather than a second literal.
 *
 * The resolution itself is never recomputed either — workspace.ts:100-104 is
 * explicit that two resolvers disagreeing is the defect that ships a search
 * missing a line somebody thought was covered. `conflict` is a SERVER-DETECTED
 * contradiction between two overrides, printed verbatim.
 */
export function RulebookBanner(props: {
  readonly clientId: string;
  readonly quarantine: QuarantineResponse | null;
}) {
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

  return (
    <div className="flex flex-col gap-5">
      <QuarantineGate quarantine={props.quarantine} />

      {resolved === undefined || resolved.length === 0 ? (
        <p
          data-testid="rulebook-banner-unresolved"
          className="rounded-md border border-state-attend-border bg-state-attend-surface px-6 py-5 font-sans text-meta leading-body text-state-attend"
        >
          The server has not resolved a checklist for this client and product.
          Nothing is assumed in its place.
        </p>
      ) : (
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
      )}
    </div>
  );
}
