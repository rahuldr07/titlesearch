import { Card, CardBody, CardHeader } from "../../components/ui";
import { ContractGap } from "../../entities/contract/ContractGap";

/**
 * THE REISSUE GATEWAY IS NOT BUILT, AND THIS IS THE REFUSAL.
 *
 * The prototype gives it its own card under the version ledger: an accent-tinted
 * header with a `v1 Locked` chip, a sentence of explanation, three radio-button
 * reasons and a one-way button that closes after v2. The card and its two
 * header slots are kept, because the refusal belongs where the design put the
 * thing rather than in a footnote on a neighbour. Everything inside it is gone.
 *
 * Design README:33 states the gate — "reissue requires reason". Nothing carries
 * a reason. Building the radio buttons anyway would produce a control whose
 * entire purpose (capture the reason) is discarded on submit, to an endpoint
 * that does not exist, satisfying a gate nothing can enforce.
 *
 * The chip in the header slot says `no endpoint` rather than the prototype's
 * `v1 Locked`, because "locked" is a STATE — it would have to be computed from
 * a reissue lifecycle that has no representation here at all.
 */
export function ReissueGateway() {
  return (
    <Card padding="none">
      <CardHeader>
        <span>Reissue gateway (Law 9)</span>
        <span className="font-mono text-label leading-flat font-semibold text-ink-muted">
          no endpoint
        </span>
      </CardHeader>
      <CardBody className="flex flex-col gap-8">
        <p className="font-sans text-meta leading-body text-ink-secondary">
          A reissue would generate a certified v2 package with a stated reason,
          leaving the delivered v1 on the ledger and preserving the audit
          history for the lender. The reason has nowhere to live, so it is not
          built.
        </p>

        <ContractGap
          drawn="Reissue Gateway — radio-button reasons, one-way, closes after v2 (design §Screens 9)"
          has={
            <>
              No reissue endpoint anywhere in `endpoints.ts`, and no
              `release.execute`-style action in `PERMISSIONS` (authz.ts:59-118) —
              `delivery.retry` (authz.ts:118) is the only delivery mutation in
              the table, and a retry re-sends the same file rather than
              rendering a new version. `Report` (entities.ts:216-222) is five
              fields: `id`, `order_id`, `version`, `shape`, `rendered_at`. There
              is no `reason` and no `supersedes`, so the reason the gate
              requires has nowhere to live and the v1→v2 link is inferred from
              version numbers rather than recorded.
            </>
          }
          needs={
            <>
              A reissue endpoint, a permission row for who may execute one, and
              a home for the reason — `Report.reason` + `Report.supersedes`, or a
              separate reissue entity. Backend conversation 2
              (ANALYSIS-screens.md §Conversation 2).
            </>
          }
        />
      </CardBody>
    </Card>
  );
}
