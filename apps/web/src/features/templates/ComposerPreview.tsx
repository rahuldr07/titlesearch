import type { TemplateBlock } from "@titlepipe/contract";
import { Card } from "../../components/ui";

/**
 * COMPOSER PREVIEW — the running order the composer will emit, drawn in the
 * paper register (rule 8) because it stands for a deliverable rather than a UI
 * surface. It is the block list filtered by the server's `included`; no wording,
 * no sample values, and nothing a real report would carry that this read does not.
 */
export function ComposerPreview({
  blocks,
  version,
}: {
  readonly blocks: readonly TemplateBlock[];
  readonly version: string;
}) {
  const shipping = blocks.filter((block) => block.included);

  return (
    <Card tone="paper" edge="raised">
      <div className="flex flex-col gap-10 leading-document">
        <div className="flex flex-col gap-2 border-b border-page-line pb-8">
          <span className="text-subject leading-tight font-bold text-page-ink">
            Title search report
          </span>
          <span className="text-meta leading-close text-page-ink">
            Composed running order &middot;{" "}
            <span className="font-mono">{version}</span>
          </span>
        </div>

        {shipping.length === 0 ? (
          <p className="text-meta leading-body text-page-ink">
            The shape includes no blocks, so the composer emits nothing. That is the
            shape as it stands, not a preview that failed to load.
          </p>
        ) : (
          <ol className="flex flex-col gap-8">
            {shipping.map((block) => (
              <li key={block.id} className="flex items-baseline gap-8">
                <span className="w-16 shrink-0 text-right font-mono text-meta leading-close text-page-ink">
                  {block.numeral}
                </span>
                <span className="flex min-w-0 flex-col gap-2">
                  <span className="text-body leading-close font-semibold text-page-ink">
                    {block.title}
                  </span>
                  <span className="text-meta leading-body text-page-ink">{block.note}</span>
                </span>
              </li>
            ))}
          </ol>
        )}

        <p className="border-t border-page-line pt-8 text-label leading-body text-page-ink">
          Blocks the shape does not include are absent here, exactly as they are absent
          from the client copy.
        </p>
      </div>
    </Card>
  );
}
