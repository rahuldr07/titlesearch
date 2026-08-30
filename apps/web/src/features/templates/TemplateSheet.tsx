import type { TemplateDetailResponse } from "@titlepipe/contract";
import type { NaSimMode } from "./TemplatesScreen";
import { SheetBlock } from "./SheetBlock";

/**
 * THE LIVE SHEET — the report rendered with the sample order, as the
 * reference draws it (RULED 2026-08-29). Blocks are clickable and the
 * selected one carries the violet border; each wears its product-lock chip.
 *
 * The NA simulation swaps a block's interpolated wording for the DECLARED
 * string of the simulated absence — all four strings are the server's
 * (`TemplateSheetBlock.na_matrix`), so the simulator previews served
 * declarations and invents nothing.
 */
export function TemplateSheet({
  template,
  naMode,
  blockKey,
  onBlock,
  wordingOf,
}: {
  readonly template: TemplateDetailResponse;
  readonly naMode: NaSimMode;
  readonly blockKey: string;
  readonly onBlock: (key: string) => void;
  readonly wordingOf: (key: string) => string;
}) {
  return (
    <div className="w-full max-w-360">
      <div className="border border-page-line bg-surface-paper px-16 py-14 shadow-sm">
        <div className="border-b border-page-line pb-6 text-center">
          <div className="font-sans text-meta leading-close font-bold tracking-caps uppercase text-page-ink">{/* rules-allow: the rendered report's title is drawn uppercase (RULING-2026-08-29) */}
            Title search report
          </div>
          <div className="pt-2 font-mono text-label leading-close text-scan-ink">
            Rendered live with sample Order 4176034-1 · Fulton County, Georgia
          </div>
          <div className="pt-1 font-sans text-label leading-close text-scan-ink">
            {`Client template: ${template.client} · Product: ${template.product} (${template.version})`}
          </div>
        </div>

        <div className="flex flex-col gap-7 pt-8">
          {template.blocks.map((block) => (
            <SheetBlock
              key={block.key}
              block={block}
              selected={block.key === blockKey}
              naMode={naMode}
              wording={wordingOf(block.key)}
              onPick={() => onBlock(block.key)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
