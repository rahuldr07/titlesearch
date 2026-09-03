import type { TemplateDetailResponse, TemplateSheetBlock } from "@titlepipe/contract";
import { NA_MODES } from "./useTemplates";

/**
 * The inspector's Null-states and Audit tabs. Both print served members —
 * the four declared absence strings and the template's provenance rows.
 */
export function NaMatrixPanel({ block }: { readonly block: TemplateSheetBlock }) {
  return (
    <div className="flex flex-col gap-6">
            <div className="border-b border-line-subtle pb-5">
              {/* The design puts a green "Compliance verified" pill here. Not
                  transcribed: nothing on TemplateSheetBlock records a
                  compliance check, so the pill would be this panel attesting
                  on the server's behalf that something passed — the same
                  refusal OrderHistoryOverlay makes against the design's
                  "SOC 2 Compliance" kicker. The sentence below states what is
                  actually served: the four declared absence strings. */}
              <div className="flex items-center justify-between gap-4">
                <span className="font-sans text-meta leading-close font-bold text-ink-primary">
                  Null state matrix
                </span>
              </div>
              <p className="pt-2 font-sans text-label leading-close text-ink-muted">
                Each block declares output strings for all four absence states —
                never collapsed into one dash.
              </p>
            </div>
            {block.na_matrix === null ? (
              <p className="font-sans text-label leading-body text-ink-muted">
                This block declares no absence strings — its structure is locked
                by the product rule and always present.
              </p>
            ) : (
              NA_MODES.map((mode) => (
                <div
                  key={mode.id}
                  data-testid={`na-${mode.id}`}
                  className="rounded-md border border-line-strong bg-surface-panel p-5"
                >
                  <span className="block pb-2 font-sans text-label leading-flat font-bold text-ink-primary">
                    {mode.label}
                  </span>
                  <code className="font-mono text-label leading-body text-ink-secondary">
                    {block.na_matrix === null ? "" : block.na_matrix[mode.id]}
                  </code>
                </div>
              ))
            )}
          </div>
  );
}

export function AuditPanelTab({ template }: { readonly template: TemplateDetailResponse }) {
  return (
    <div className="flex flex-col gap-6">
            <span className="border-b border-line-subtle pb-4 font-sans text-meta leading-close font-bold text-ink-primary">
              Provenance &amp; audit trail
            </span>
            <AuditFact label="Reference source">
              <span className="font-mono font-semibold">{template.source_ref}</span>
            </AuditFact>
            <AuditFact label="Source citation">{template.source_citation}</AuditFact>
            {/* The design carries an "Isolation audit — ✓ Zero cross-client
                contamination" row here. Not transcribed: TemplateDetailResponse
                has no isolation or audit-result member, so the tick would be a
                tenant-isolation assertion this screen cannot cite. The rows
                that remain each print a served value. */}
            <AuditFact label="SHA-256 cryptographic seal">
              <code className="block rounded-md border border-line-subtle bg-surface-sunken p-4 font-mono text-label leading-body break-all text-ink-secondary">
                {template.sha256}
              </code>
            </AuditFact>
          </div>
  );
}

function AuditFact({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-sans text-label leading-flat font-bold text-ink-muted">{label}</span>
      <span className="font-sans text-label leading-body text-ink-primary">{children}</span>
    </div>
  );
}
