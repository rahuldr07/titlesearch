import type { TemplateDetailResponse } from "@titlepipe/contract";
import { Card } from "../../components/ui";

/**
 * Split diff — the client's phrasing against the product baseline, per
 * block. Both columns are served: `baseline` is the product default and the
 * custom side is the client's wording (or the unsaved draft being edited,
 * so the diff shows what a save would publish).
 */
export function TemplateDiff({
  template,
  wordingOf,
}: {
  readonly template: TemplateDetailResponse;
  readonly wordingOf: (key: string) => string;
}) {
  return (
    <div className="w-full max-w-420">
      <Card>
        <div className="flex items-start justify-between gap-6 pb-6">
          <div className="flex flex-col gap-1">
            <h3 className="font-sans text-body leading-close font-bold text-ink-primary">
              Split comparison vs. product overlay baseline
            </h3>
            <p className="font-sans text-label leading-close text-ink-muted">
              {`Comparing ${template.client} customized phrasing against default ${template.product} base expressions.`}
            </p>
          </div>
          <span className="shrink-0 rounded-pill bg-action-surface px-4 py-1 font-mono text-label leading-flat font-semibold text-ink-secondary">
            Product lock active
          </span>
        </div>

        <div className="flex flex-col gap-6">
          {template.blocks
            .filter((block) => block.baseline !== "")
            .map((block) => (
              <div
                key={block.key}
                data-testid={`diff-${block.key}`}
                className="rounded-md border border-line-strong bg-surface-sunken p-6"
              >
                <div className="flex items-baseline justify-between gap-4 pb-4">
                  <span className="font-sans text-label leading-flat font-bold text-ink-secondary">
                    {`${block.key} section phrasing`}
                  </span>
                  <span className="font-mono text-label leading-flat text-ink-muted">
                    {`${block.key}.*`}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="rounded-md border border-line-strong bg-surface-panel p-5">
                    <span className="block pb-2 font-sans text-label leading-flat font-bold text-ink-muted">
                      Product baseline default
                    </span>
                    <span className="font-mono text-label leading-body text-ink-secondary">
                      {block.baseline}
                    </span>
                  </div>
                  <div className="rounded-md border border-action-border bg-action-surface p-5">
                    <span className="block pb-2 font-sans text-label leading-flat font-bold text-ink-muted">
                      {`${template.client} custom template`}
                    </span>
                    <span className="font-mono text-label leading-body font-semibold text-ink-primary">
                      {wordingOf(block.key)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}
