import { Card, CardHeader, CardBody } from "../../components/ui";
import { ExportManifest } from "./ExportManifest";

/**
 * THE COMPILED MANIFEST, VERBATIM. `export_spec` arrives as a string the server
 * composed; it is printed as it came. Re-parsing and re-serialising it would put
 * the browser's formatting on a server artifact the render workers consume.
 *
 * The header's action opens the export manifest, which prints the version the
 * spec was compiled at and names the two figures the design's manifest wants
 * and the response does not carry.
 */
export function ExportSpec({
  spec,
  version,
}: {
  readonly spec: string;
  readonly version: string;
}) {
  return (
    <Card padding="none">
      <CardHeader>
        <span>Export spec</span>
        <ExportManifest version={version} />
      </CardHeader>
      <CardBody>
        <p className="pb-6 font-sans text-label leading-body text-ink-muted">
          As the server composed it.
        </p>
        <pre className="overflow-x-auto rounded-md border border-line-subtle bg-surface-sunken p-8 font-mono text-label leading-body text-ink-primary">
          <code>{spec}</code>
        </pre>
      </CardBody>
    </Card>
  );
}
