import type { TemplateDetailResponse } from "@titlepipe/contract";
import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogTrigger,
  InnerPanel,
} from "../../components/ui";

/**
 * The export modal. The version, the mapped-field figure and the SHA-256
 * seal are all served on `TemplateDetailResponse`; the digest is the
 * server's seal over the spec it emits — nothing is hashed in the browser.
 */
export function ExportSpecDialog({ template }: { readonly template: TemplateDetailResponse }) {
  return (
    <DialogTrigger>
      <Button variant="secondary" size="sm" data-testid="open-export-manifest">
        Export spec
      </Button>
      <Dialog title="Template export & cryptographic manifest">
        <DialogBody>
          <p data-testid="export-manifest" className="font-sans text-meta leading-body text-ink-secondary">
            {"Template spec for "}
            <span className="font-semibold text-ink-primary">{template.name}</span>
            {` (${template.version}). The compiled spec itself is the JSON schema view, verbatim, as the server composed it.`}
          </p>

          <InnerPanel padding="tight">
            <div className="flex flex-col gap-6">
              <ManifestRow label="Template version">
                <span className="font-mono font-semibold">{template.version}</span>
              </ManifestRow>
              <ManifestRow label="Mapped fields">
                <span className="font-mono font-semibold text-state-settled">
                  {`${String(template.mapped_fields)} of ${String(template.total_fields)}`}
                </span>
              </ManifestRow>
              <ManifestRow label="Reference source & citation">
                <span className="font-mono">{template.source_ref}</span>
                <span className="block pt-1 font-sans text-label leading-close text-ink-secondary">
                  {template.source_citation}
                </span>
              </ManifestRow>
              <ManifestRow label="SHA-256 seal digest">
                <code className="block rounded-md border border-line-subtle bg-surface-panel p-4 font-mono text-label leading-body break-all text-ink-secondary">
                  {template.sha256}
                </code>
              </ManifestRow>
            </div>
          </InnerPanel>
        </DialogBody>
        <DialogFooter>
          <Button slot="close">Close</Button>
        </DialogFooter>
      </Dialog>
    </DialogTrigger>
  );
}

function ManifestRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-sans text-label leading-flat font-bold text-ink-muted">{label}</span>
      <span className="font-sans text-meta leading-close text-ink-primary">{children}</span>
    </div>
  );
}
