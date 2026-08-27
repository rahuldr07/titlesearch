import type { DeliveryWithReport } from "@titlepipe/contract";
import { Card, CardBody, CardHeader, cx } from "../../components/ui";
import { ContractGap } from "../../entities/contract/ContractGap";

/**
 * THE VERSION LEDGER — v1 immutable, v2 the reissue, v1 "Superseded · retained".
 *
 * ══ SUPERSESSION IS READ OFF THE SERVER'S ROWS, NOT DECIDED HERE ═══════════
 *
 * `INVARIANTS:5` forbids the UI re-deriving counts, chain termination or
 * release resolution, and "which version is current" is the same kind of
 * question. But there is no `Report.supersedes` to read, so the honest position
 * is narrow: this lists every version the server returned for one order, in the
 * server's order, and says which is the HIGHEST NUMBER — which is arithmetic on
 * `Report.version` (entities.ts:219), not a state machine.
 *
 * The word "Superseded" is therefore attached to a v1 that has a v2 in the same
 * response, and nothing else about it changes. Specifically NOT claimed: that
 * the v2 replaced it, that the v1 was withdrawn, or that a client was told. All
 * three would be release-resolution, and all three are unbacked.
 *
 * "Retained" is not a status either — it is the OBSERVATION that the row is
 * still in the response, which is `endpoints.ts:615-616`'s point: both v1 and
 * v2 appear, "the pair is the defect record."
 */
export function VersionLedger({
  versions,
}: {
  readonly versions: readonly DeliveryWithReport[];
}) {
  const highest = versions.reduce(
    (max, row) => Math.max(max, row.report?.version ?? 0),
    0,
  );

  return (
    <Card padding="none">
      <CardHeader>Version ledger</CardHeader>
      <CardBody className="flex flex-col gap-10">
        {versions.map((row) => {
          const version = row.report?.version ?? null;
          const superseded = version !== null && version < highest;
          return (
            <div
              key={row.id}
              data-testid={`version-${String(version)}`}
              data-superseded={superseded}
              className="flex flex-col gap-3 border-b border-line-subtle pb-8 last:border-b-0 last:pb-0"
            >
              <span className="font-mono text-body leading-close font-semibold text-ink-primary">
                {version === null ? "no report on this delivery" : `v${String(version)}`}
              </span>
              <span
                className={cx(
                  "font-sans text-meta leading-close",
                  superseded ? "text-ink-muted" : "text-ink-secondary",
                )}
              >
                {superseded
                  ? "Superseded · retained — a later version exists and this row is still in the record"
                  : "Highest version in the record"}
              </span>
              {row.report !== null && (
                <span className="font-mono text-label leading-flat text-ink-faint">
                  rendered {row.report.rendered_at} · shape {row.report.shape}
                </span>
              )}
            </div>
          );
        })}

        {/*
         * THE REISSUE GATEWAY IS NOT BUILT, AND THIS IS THE REFUSAL.
         *
         * Design §Screens 9 draws a one-way gateway with radio-button reasons
         * that closes after v2, and design README:33 states the gate: "reissue
         * requires reason". Nothing carries a reason. Building the radio
         * buttons anyway would produce a control whose entire purpose — capture
         * the reason — is discarded on submit, to an endpoint that does not
         * exist, satisfying a gate nothing can enforce.
         */}
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
