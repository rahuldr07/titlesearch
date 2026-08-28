import { useState } from "react";
import { useRead } from "../../app/useRead";
import { usePermissions, hasAction } from "../../app/session/permissions";
import { useSignedIn } from "../../app/session/signedIn";
import { DEMO_ORDER_ID, reconciliation } from "../../shared/reconciliationQueries";
import { rules as rulebook } from "../../shared/accountQueries";
import { notify } from "../../shared/notify";
import { Empty } from "../../components/ui";
import { ContractGap } from "../../entities/contract/ContractGap";
import { ReadState } from "./ReadState";
import { DivergenceList } from "./DivergenceList";
import { DivergenceDetail } from "./DivergenceDetail";
import { useRuleDivergence } from "./useReconciliation";

/**
 * BLIND-FIFTY DIVERGENCES, at `/reconciliation` (`authz.ts:78`,
 * `senior`/`admin`).
 *
 * Two seats typed the same order without seeing each other or the model; where
 * they disagree, a senior rules — and `endpoints.ts:345` states the one rule
 * this screen exists to enforce: "A RULING WITH NO SOURCE IS AN OPINION.
 * Citation is required."
 *
 * ══ THIS SCREEN IS IN NO DESIGN ════════════════════════════════════════════
 *
 * Absent from the 2026-08 prototype entirely, so nothing here is transcribed.
 * Built to the SYSTEM — RECIPES, the 14 rules, and the shape
 * `features/escalations` established for a refusal-bearing mutation screen.
 *
 * ══ IT IS ORDER-SCOPED, AND THERE IS NO PICKER ═════════════════════════════
 *
 * `GET /api/reconciliation/{order}` reads ONE order. The route has no `:order`
 * segment yet, and the missing parameter is NOT worked around with a list: this
 * product has no order-browse endpoint (`endpoints.ts:69`) and `INVARIANTS:22`
 * states the absence as a refusal — "no list, no browsing, no cherry-picking."
 * A dropdown over orders here would be the first line of the feature that rule
 * forbids. So the screen names the one order it can, says so on its face, and
 * reports the gap.
 *
 * ══ NOTHING IS COUNTED AND NOTHING IS TIMED ════════════════════════════════
 *
 * `INVARIANTS:5`, `23`, `26`. No "N open", no agreement rate, no time-to-rule.
 * An agreement rate over a blind pair is an accuracy headline by another name,
 * and root AGENTS.md keeps those out.
 */
export function ReconciliationScreen() {
  const orderId = DEMO_ORDER_ID;
  const divergences = useRead(reconciliation(orderId));
  const rules = useRead(rulebook);
  const permissions = usePermissions(useSignedIn((s) => s.account !== null));
  const [selected, setSelected] = useState<string | null>(null);
  /** Bumped on a recorded ruling; remounts the form, which is how it clears. */
  const [ruled, setRuled] = useState(0);

  const rule = useRuleDivergence(orderId);
  const mayRule = hasAction(permissions.data?.rules, "reconciliation.rule");

  const rows = divergences.data?.divergences ?? [];
  const current = rows.find((row) => row.id === selected) ?? rows[0] ?? null;

  return (
    <div
      data-testid="reconciliation-screen"
      className="tp-screen-enter flex h-full min-h-0 flex-col gap-12 overflow-y-auto p-14"
    >
      <header className="flex flex-col gap-3">
        <h1 className="font-sans text-title leading-tight font-bold text-ink-primary">
          Reconciliation
        </h1>
        <p className="font-sans text-meta leading-body text-ink-secondary">
          Where the two blind seats disagree on{" "}
          {/* Rule 3: an order ref is an identifier, so it is mono. */}
          <span className="font-mono text-ink-primary">{orderId}</span>. A ruling
          with no source is an opinion, so every one carries its citation.
        </p>
      </header>

      <ContractGap
        drawn="The order this screen rules for, handed over from wherever the reader came from"
        has={
          <>
            `GET /api/reconciliation/{"{order}"}` (endpoints.ts:338) is
            order-scoped, and the route `/reconciliation` carries no `:order`
            segment to fill it from. There is no order-list endpoint to choose
            one with either — `endpoints.ts:69` and `INVARIANTS:22` — so this
            screen reads the single demo order named above rather than offering
            a picker over orders.
          </>
        }
        needs={
          <>
            An `:order` path parameter on the route, handed over from the order
            hub the way `queries.ts`&rsquo;s `orderContext(id)` reads are — the
            id already travels with the order everywhere else.
          </>
        }
      />

      <div className="grid grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-12">
        <ReadState query={divergences} of="the divergences">
          {(data) => (
            <DivergenceList
              divergences={data.divergences}
              selectedId={current?.id ?? null}
              onSelect={setSelected}
            />
          )}
        </ReadState>

        <ReadState query={rules} of="the rulebook">
          {(book) =>
            current === null ? (
              <Empty
                title="No divergence selected"
                reason="The two seats agreed everywhere they were both asked on this order."
              />
            ) : (
              <DivergenceDetail
                key={`${current.id}-${String(ruled)}`}
                divergence={current}
                rules={book.rules}
                ruling={rule.pending}
                {...(mayRule
                  ? {
                      onRule: (body) =>
                        rule.submit(body, () => {
                          setRuled((n) => n + 1);
                          notify.success("Ruling recorded on its citation.");
                        }),
                    }
                  : { onRule: null })}
              />
            )
          }
        </ReadState>
      </div>
    </div>
  );
}
