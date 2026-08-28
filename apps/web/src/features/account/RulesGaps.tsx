import { ContractGap } from "../../entities/contract/ContractGap";

/**
 * THE THREE RULES SUB-TABS THAT HAVE NO READ BEHIND THEM.
 *
 * `reference-app.html` § `isSettings`, `rulesTabs`, draws five: Catalog,
 * Products, Resolved, Escalations, Coverage. Two of them are built — Catalog is
 * the list above, and Escalations is the PENDING rows inside it, which is where
 * a candidate belongs when the only thing that distinguishes it is
 * `Rule.status` (`INVARIANTS:38`). The other three read shapes `RulesResponse`
 * (endpoints.ts) does not carry, and every one of them is a NUMBER a reader
 * would act on, so none may be assembled here from what happens to have
 * arrived. Said once, as three named asks, rather than three empty tabs.
 */
export function RulesGaps() {
  return (
    <div className="flex flex-col gap-8">
      <ContractGap
        drawn="Products — the active product list with its per-product overlay pill, and an 'Add product' field (design §Settings, Rules & routing → Products)"
        has={
          <>
            Nothing. There is no product entity in{" "}
            <code className="font-mono text-label">packages/contract</code>: no
            product record, no overlay-per-product join, and no endpoint that writes
            one. A product name typed into this screen would name a search depth the
            pipeline has never been told about.
          </>
        }
        needs={
          <>
            A product shape carrying its own overlay rules — the neighbouring
            `Rule.jurisdiction_scope` is the closest thing on the wire and scopes a
            rule to a PLACE, not to a product.
          </>
        }
      />

      <ContractGap
        drawn="Resolved — global, product and jurisdiction layers with a rule count against each (design §Settings, Rules & routing → Resolved)"
        has={
          <>
            Nothing. `RulesResponse` is a flat list with no layer on any row, so the
            three counts the design prints would be the browser sorting rules into
            buckets it invented and then counting its own buckets — a resolution
            order asserted by the UI, which is the one thing a rulebook screen may
            never do.
          </>
        }
        needs={
          <>
            A `layer` on `Rule` and the server&rsquo;s own count per layer. The
            precedence itself is the server&rsquo;s answer too, not a sentence this
            screen writes.
          </>
        }
      />

      <ContractGap
        drawn="Coverage — the state coverage map: counties verified, overlay rules and a live/pending status per state (design §Settings, Rules & routing → Coverage)"
        has={
          <>
            Nothing. No coverage, county-verification or state-readiness shape exists
            in the contract. `JurisdictionResponse` (design2.ts:120) answers for ONE
            code that was asked for; it carries no roster of states and no notion of
            a state being live.
          </>
        }
        needs={
          <>
            A coverage endpoint whose rows carry the server&rsquo;s own verified
            count and its own status. &ldquo;Live in this state&rdquo; is a
            compliance claim, and this screen may not compute one.
          </>
        }
      />
    </div>
  );
}
