import { Card, CardHeader, CardBody } from "../../components/ui";

/**
 * THE COMPILED MANIFEST, VERBATIM. `export_spec` arrives as a string the server
 * composed; it is printed as it came. Re-parsing and re-serialising it would put
 * the browser's formatting on a server artifact the render workers consume.
 */
export function ExportSpec({ spec }: { readonly spec: string }) {
  return (
    <Card padding="none">
      <CardHeader>
        <span>Export spec</span>
        <span className="font-sans text-label leading-flat font-medium text-ink-faint">
          As the server composed it
        </span>
      </CardHeader>
      <CardBody>
        <pre className="overflow-x-auto rounded-md border border-line-subtle bg-surface-sunken p-8 font-mono text-label leading-body text-ink-primary">
          <code>{spec}</code>
        </pre>
      </CardBody>
    </Card>
  );
}
