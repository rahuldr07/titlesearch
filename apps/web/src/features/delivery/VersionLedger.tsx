import type { DeliveryWithReport } from "@titlepipe/contract";
import { Badge, Card, CardBody, CardHeader, cx } from "../../components/ui";

/**
 * THE VERSION LEDGER — v1 immutable, v2 the reissue, v1 "Superseded · retained".
 *
 * The prototype's card: header with "Law 9 · append-only" on the right, then
 * bordered rows, each carrying the version numeral in mono, a tinted status
 * capsule, a mono meta line, and — where there is one — a reason line beneath.
 *
 * ⚠ RULED 2026-08-29 — `docs/frontend/design-2026-08/RULING-2026-08-29.md`.
 * Supersession is now READ OFF THE SERVER'S ROWS, not decided here: a
 * reissued report states, on the wire, which version it superseded
 * (`Report.supersedes`) and the reason it filed (`Report.reason`). The
 * "Superseded · retained" capsule attaches to the row another row NAMES as
 * superseded; "Draft — unreleased" is the row whose `status` is `draft`.
 * Nothing takes a max() to decide which version is current any more.
 */
export function VersionLedger({
  versions,
}: {
  readonly versions: readonly DeliveryWithReport[];
}) {
  /** Version numbers some row on this ledger claims to supersede. */
  const supersededVersions = new Set(
    versions.flatMap((row) =>
      row.report?.supersedes === null || row.report === null ? [] : [row.report.supersedes],
    ),
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
          const superseded = version !== null && supersededVersions.has(version);
          const draft = row.status === "draft";
          return (
            <div
              key={row.id}
              data-testid={`version-${String(version)}`}
              data-superseded={superseded}
              className={cx(
                "flex flex-col gap-3 rounded-md border px-6 py-5",
                superseded
                  ? "border-line-subtle bg-surface-sunken"
                  : draft
                    ? "border-state-attend-border bg-state-attend-surface"
                    : "border-line-strong bg-surface-panel",
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="font-mono text-body leading-close font-bold text-ink-primary">
                  {version === null ? "no report on this delivery" : `v${String(version)}`}
                </span>
                {/* The reference's three capsules, each read off a server
                    member: draft off `status`, superseded off another row's
                    `supersedes`, released otherwise. Rule 6 spends the tinted
                    capsule on the moment of record — the released row. */}
                {draft ? (
                  <span className="shrink-0 rounded-pill border border-state-attend-border bg-surface-panel px-5 py-1 font-sans text-label leading-flat font-semibold text-state-attend">
                    Draft — unreleased
                  </span>
                ) : superseded ? (
                  <span className="shrink-0 rounded-pill bg-control-fill px-5 py-1 font-sans text-label leading-flat font-semibold text-ink-muted">
                    Superseded · retained
                  </span>
                ) : (
                  <Badge tone="settled">Released · immutable</Badge>
                )}
              </div>
              {row.report !== null && (
                <span className="font-mono text-label leading-close break-all text-ink-muted">
                  {`rendered ${row.report.rendered_at} · shape ${row.report.shape}`}
                  {row.report.supersedes !== null &&
                    ` · supersedes v${String(row.report.supersedes)}`}
                </span>
              )}
              {row.report !== null && row.report.reason !== null && (
                /* The prototype's "Reason:" line — the reissue's stated
                   reason, persisted on the report row (RULED 2026-08-29). */
                <span className="font-sans text-label leading-close text-ink-secondary">
                  {`Reason: ${row.report.reason}`}
                </span>
              )}
              {superseded && (
                <span className="font-sans text-label leading-close text-ink-secondary">
                  A later version names this one superseded; the row stays on the
                  record.
                </span>
              )}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
