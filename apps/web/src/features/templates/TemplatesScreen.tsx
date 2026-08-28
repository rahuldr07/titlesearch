import { useRead } from "../../app/useRead";
import { templates } from "../../shared/templateQueries";
import { QueryState } from "../../entities/state/QueryState";
import { Empty } from "../../components/ui";
import { TemplateBlocks } from "./TemplateBlocks";
import { ComposerPreview } from "./ComposerPreview";
import { ClientSamples } from "./ClientSamples";
import { ExportSpec } from "./ExportSpec";

/**
 * TEMPLATES ARCHITECT — the report shape, the clients scoped to it, the compiled
 * spec and the running order the composer will emit.
 *
 * THE EDITOR THE DESIGN DRAWS IS NOT HERE, AND NEITHER IS ITS "INITIALIZE
 * TEMPLATE WORKSPACE" DIALOG. The prototype carries a wording textarea, a token
 * palette, null-state inputs, "+ new template", "+ add custom section", a
 * remove ✕, a save button, and a create form whose client list is four named
 * companies the contract never mentions. `template.edit` is a real grant
 * (`authz.ts:93`) but no write endpoint exists — nothing creates a template and
 * nothing edits one — so every one of those is ABSENT rather than disabled,
 * INVARIANT 42/43. Said once, below, and nowhere else.
 */
export function TemplatesScreen() {
  const shape = useRead(templates);

  return (
    <div
      data-testid="templates-screen"
      tabIndex={0}
      role="region"
      aria-label="Templates architect"
      className="tp-state flex h-full min-h-0 flex-col gap-12 overflow-y-auto px-16 pt-14 pb-32"
    >
      <header className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-6">
          <h1 className="font-sans text-title leading-tight font-bold text-ink-primary">
            Templates architect
          </h1>
          {shape.data !== undefined && (
            <span className="font-mono text-meta leading-flat font-semibold text-ink-muted">
              {shape.data.version}
            </span>
          )}
        </div>
        <p className="max-w-320 font-sans text-body leading-body text-ink-secondary">
          The shape a report is composed into, and which of its blocks reach a client
          copy.
        </p>
        <p className="max-w-320 font-sans text-meta leading-body text-ink-muted">
          Read-only: neither creating nor editing a template has an endpoint, so the
          initialize-workspace dialog, the wording editor and the block controls the
          design draws are absent rather than disabled.
        </p>
      </header>

      <QueryState query={shape} of="the template shape">
        {(data) =>
          data.blocks.length === 0 ? (
            <Empty
              title="No blocks"
              reason="The shape arrived with no blocks. The server sends the block list and this screen knows no default set to fall back on."
            />
          ) : (
            <div className="grid min-w-0 grid-cols-3 items-start gap-8">
              <div className="col-span-2 flex min-w-0 flex-col gap-8">
                <TemplateBlocks blocks={data.blocks} />
                <ComposerPreview blocks={data.blocks} version={data.version} />
              </div>
              <div className="flex min-w-0 flex-col gap-8">
                <ClientSamples samples={data.samples} />
                <ExportSpec spec={data.export_spec} version={data.version} />
              </div>
            </div>
          )
        }
      </QueryState>
    </div>
  );
}
