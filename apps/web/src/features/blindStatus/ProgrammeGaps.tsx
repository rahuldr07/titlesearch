import { ContractGap } from "../../entities/contract/ContractGap";

/**
 * THE PROGRAMME AS A WHOLE — the fifty, and when a package is done with.
 *
 * `RosterGaps` is about one package. These two are about the run: which orders
 * are in the blind fifty at all, and what "finished" means for one of them.
 * Both are single-order-blind here, because every surface this screen has is
 * keyed on ONE order id and there is no programme object anywhere.
 *
 * The third gap is smaller and sharper: an absence on a divergence row has no
 * reason attached, so the list above cannot obey rule 14 even where it wants
 * to. That is stated where the ask is, rather than as a footnote on a row.
 */
export function ProgrammeGaps() {
  return (
    <div className="flex flex-col gap-8">
      <ContractGap
        drawn="Coverage across the fifty — which packages are in the programme, and which of them have been through both seats"
        has={
          <>
            Nothing. Every surface this screen can reach is keyed on ONE order:
            `GET /api/reconciliation/{"{order}"}` (endpoints.ts:338-342)
            returns `order_id` and its own divergences, and there is no
            programme, cohort or run object in the contract. Composing the fifty
            in the browser is not available either — the browse endpoint was
            removed by construction (endpoints.ts:69, :77-82) and INVARIANT 22
            forbids reintroducing one.
          </>
        }
        needs={
          <>
            A programme read that names the cohort: the order ids enrolled in
            this blind run, and each one&rsquo;s capture state as the SERVER
            calls it. The cohort has to come from the server rather than from a
            list this screen assembles, or the denominator of every accuracy
            figure downstream becomes a browser&rsquo;s opinion.
          </>
        }
      />

      <ContractGap
        drawn="Completion — whether this package is finished with capture and ready to reconcile"
        has={
          <>
            No state machine. `LifecycleResponse` (intake.ts:246) is the
            pipeline&rsquo;s stages and blind capture is not one of them, and
            nothing on `ReconciliationResponse` says whether capture is open,
            closed or never started. INVARIANT 1 puts every state machine on the
            server, so this screen may not infer one — an empty divergence list
            is not &ldquo;done&rdquo; and a full one is not &ldquo;in
            progress&rdquo;.
          </>
        }
        needs={
          <>
            A server-owned capture state on the order, in the shape
            `LifecycleStamp` (intake.ts:296) already uses elsewhere: one word the
            server chose, plus its tone. The rule the strip follows applies here
            unchanged — print the stamp, never compose one.
          </>
        }
      />

      <ContractGap
        drawn="Which absence a blank side of a divergence is — the four-state taxonomy on the row"
        has={
          <>
            `Reconciliation` (entities.ts:202-214) types `value_a` and `value_b`
            as `z.string().nullable()` and carries no `na_reason`, while
            `BlindEntryInput` (entities.ts:289-296) does. The typist&rsquo;s
            answer is captured and then dropped by the time it reaches this
            screen, so a null side cannot be told from NOT_FOUND, NOT_STATED or
            PRESENT_UNREADABLE. Rule 14 and INVARIANT 7 forbid collapsing them,
            so the row says it does not know rather than printing a dash.
          </>
        }
        needs={
          <>
            `na_reason_a` / `na_reason_b` on `Reconciliation`, carried through
            from the entries. Without them a senior rules on an absence without
            being told what kind it is, which is the difference between a
            document that is silent and a page nobody could read.
          </>
        }
      />
    </div>
  );
}
