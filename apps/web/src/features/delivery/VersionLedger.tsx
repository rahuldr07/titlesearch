import type { DeliveryWithReport } from "@titlepipe/contract";
import { Badge, Card, CardBody, CardHeader, cx } from "../../components/ui";

/**
 * THE VERSION LEDGER — v1 immutable, v2 the reissue, v1 "Superseded · retained".
 *
 * The prototype's card: header with "Law 9 · append-only" on the right, then
 * bordered rows at the 10px rung, each carrying the version numeral in mono, a
 * tinted status capsule, a mono meta line, and — where there is one — a reason
 * line beneath. That shape is kept; the row's "View →" is not, for the same
 * reason `CertifiedDeliverables` has no View: nothing routes to a report file.
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
 *
 * The capsule is rule 6's one licensed spend on this screen: a version on a
 * ledger is a moment of record, which is exactly what a tinted capsule is for.
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
      <CardHeader>
        <span>Version ledger</span>
        <span className="font-mono text-label leading-flat font-semibold text-ink-muted">
          Law 9 · append-only
        </span>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        {versions.map((row) => {
          const version = row.report?.version ?? null;
          const superseded = version !== null && version < highest;
          return (
            <div
              key={row.id}
              data-testid={`version-${String(version)}`}
              data-superseded={superseded}
              className={cx(
                "flex flex-col gap-3 rounded-md border px-6 py-5",
                superseded
                  ? "border-line-subtle bg-surface-sunken"
                  : "border-line-strong bg-surface-panel",
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="font-mono text-body leading-close font-bold text-ink-primary">
                  {version === null ? "no report on this delivery" : `v${String(version)}`}
                </span>
                {/* Grey for the superseded row, green for the latest — the
                    prototype's own two tints. Rule 6 spends the tinted capsule
                    on the moment of record only, so the superseded row gets a
                    plain neutral pill rather than a second `Badge` tone. */}
                {superseded ? (
                  <span className="shrink-0 rounded-pill bg-control-fill px-5 py-1 font-sans text-label leading-flat font-semibold text-ink-muted">
                    Superseded · retained
                  </span>
                ) : (
                  <Badge tone="settled">Highest version</Badge>
                )}
              </div>
              {row.report !== null && (
                <span className="font-mono text-label leading-close break-all text-ink-muted">
                  rendered {row.report.rendered_at} · shape {row.report.shape}
                </span>
              )}
              {superseded && (
                /* The prototype's "Reason:" line. The reason a reissue was
                   ordered has nowhere to live in the contract (see
                   `ReissueGateway`), so what stands here is the only thing
                   this row's position actually means. */
                <span className="font-sans text-label leading-close text-ink-secondary">
                  A later version exists and this row is still in the record.
                </span>
              )}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
