import type { Artifact, DeliveryWithReport } from "@titlepipe/contract";
import { Button, Card, CardBody, CardHeader, LinkButton } from "../../components/ui";
import { useRead } from "../../app/useRead";
import { QueryState } from "../../entities/state/QueryState";
import { artifacts } from "../../shared/artifactQueries";

/**
 * The delivered files, each with its own digest. A row finds its version via
 * the artifact's `report_id`, never by position; an artifact whose report is
 * not among these deliveries still renders.
 */
export function CertifiedDeliverables({
  deliveries,
}: {
  readonly deliveries: readonly DeliveryWithReport[];
}) {
  const orderId =
    deliveries.find((row) => row.report !== null)?.report?.order_id ?? null;

  if (orderId === null) {
    return (
      <Card>
        <p className="font-sans text-meta leading-body text-ink-secondary">
          No delivery here names a report, so there is no order to fetch
          artifacts for.
        </p>
      </Card>
    );
  }
  return <Deliverables orderId={orderId} deliveries={deliveries} />;
}

function Deliverables({
  orderId,
  deliveries,
}: {
  readonly orderId: string;
  readonly deliveries: readonly DeliveryWithReport[];
}) {
  const read = useRead(artifacts(orderId));

  return (
    <QueryState query={read} of="the certified deliverables">
      {(data) => (
        <Card padding="none">
          <CardHeader>
            <span>Certified deliverables</span>
            <span className="font-mono text-label leading-flat font-semibold text-ink-muted">
              {data.artifacts.length === 1
                ? "one file · immutable"
                : `${String(data.artifacts.length)} files · immutable`}
            </span>
          </CardHeader>

          {data.artifacts.length === 0 ? (
            <CardBody>
              <p className="font-sans text-meta leading-body text-ink-secondary">
                The server returned no artifact for this order.
              </p>
            </CardBody>
          ) : (
            <div className="flex flex-col">
              {data.artifacts.map((artifact) => (
                <ArtifactRow
                  key={artifact.id}
                  artifact={artifact}
                  version={versionOf(deliveries, artifact.report_id)}
                />
              ))}
            </div>
          )}
        </Card>
      )}
    </QueryState>
  );
}

function ArtifactRow({
  artifact,
  version,
}: {
  readonly artifact: Artifact;
  readonly version: number | null;
}) {
  return (
    <div
      data-testid={`artifact-${artifact.id}`}
      className="flex items-start gap-8 border-b border-line-subtle px-12 py-8 last:border-b-0"
    >
      <span className="flex h-24 w-20 shrink-0 items-center justify-center rounded-paper border border-page-line bg-surface-paper font-serif text-label leading-flat font-bold text-page-ink">
        {version === null ? "—" : `v${String(version)}`}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex min-w-0 items-center gap-4">
          <span className="truncate font-mono text-meta leading-close font-semibold text-ink-primary">
            {artifact.filename}
          </span>
          <span className="shrink-0 rounded-pill bg-control-fill px-4 py-1 font-mono text-label leading-flat font-semibold text-ink-muted">
            {artifact.media_type}
          </span>
        </span>
        <span className="font-mono text-label leading-close text-ink-muted">
          {String(artifact.bytes)} bytes
        </span>
        {/* The whole digest, never a prefix — a truncated hash cannot be verified. */}
        <span
          data-testid={`artifact-sha-${artifact.id}`}
          className="rounded-md bg-control-fill px-4 py-1 font-mono text-label leading-close break-all text-ink-secondary"
        >
          sha-256 {artifact.sha256}
        </span>
      </span>

      {/*
        The door, when the server has one. `href: null` means this server holds
        the artifact's record and not its bytes — a real state on a demo
        server, and the button says so in place rather than pointing at an
        address that answers with the application's own not-found screen.
        `disabledBecause`, never `isDisabled`: a blocked control states its
        reason, and the type refuses the shortcut.
      */}
      {artifact.href === null ? (
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0"
          data-testid={`artifact-nofile-${artifact.id}`}
          disabledBecause="This server holds the digest of this artifact, not the file. Nothing was rendered for it."
          onPress={() => undefined}
        >
          View
        </Button>
      ) : (
        <LinkButton
          href={artifact.href}
          size="sm"
          className="shrink-0"
          data-testid={`artifact-view-${artifact.id}`}
        >
          View
        </LinkButton>
      )}
    </div>
  );
}

/** The version the artifact's own `report_id` points at, or null if none does. */
function versionOf(
  deliveries: readonly DeliveryWithReport[],
  reportId: string,
): number | null {
  const match = deliveries.find((row) => row.report_id === reportId);
  return match?.report?.version ?? null;
}
