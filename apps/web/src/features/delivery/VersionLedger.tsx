import type { DeliveryWithReport } from "@titlepipe/contract";
import { Badge, Card, CardBody, CardHeader, cx } from "../../components/ui";

/**
 * Supersession is read off the server's rows, not decided here: a reissued
 * report names the version it superseded (`Report.supersedes`) and its reason
 * (`Report.reason`). Nothing takes a max() to decide which version is current.
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
