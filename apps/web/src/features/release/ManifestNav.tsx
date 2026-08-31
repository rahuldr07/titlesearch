import type { ManifestBlock } from "@titlepipe/contract";
import { ContractGap } from "../../entities/contract/ContractGap";

/**
 * One row per block the server composed, in the server's own order. The
 * per-block figures carry no mark — a ✓/◆ here would be this screen deciding
 * that a block is short of citations, and no such verdict exists on the wire;
 * the gates are where citation coverage is adjudicated. Two of the design's
 * rail affordances are filed as the gap below rather than drawn — both need
 * fields that do not exist.
 */
export function ManifestNav(props: { readonly blocks: readonly ManifestBlock[] }) {
  return (
    <nav aria-label="Manifest blocks" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-8">
      <span className="font-sans text-label leading-flat font-bold text-ink-muted">
        Manifest blocks
      </span>
      <ul data-testid="manifest-nav" className="flex flex-col">
        {props.blocks.map((block) => (
          <li key={block.id}>
            <a
              href={`#manifest-${block.id}`}
              data-testid={`manifest-nav-${block.id}`}
              className="tp-state flex items-baseline gap-5 rounded-md px-5 py-4 hover:bg-row-hover"
            >
              <span className="w-10 shrink-0 font-mono text-label leading-close text-ink-faint">
                {block.numeral}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-sans text-meta leading-close font-semibold text-ink-primary">
                  {block.title}
                </span>
                <span className="font-sans text-label leading-close text-ink-muted">
                  {`${String(block.cited)} of ${String(block.field_count)} fields cited`}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      <ContractGap
        drawn="A second document behind a 'Publication manifest / Telemetry log' tab pair, and a per-block Included / Omitted toggle"
        has={
          <>
            One document. `CompositionResponse` (design.ts) returns a single
            `blocks` array and names no second manifest, and `ManifestBlock`
            is six fields — id, numeral, title, values, field_count, cited —
            with no `optional` and no include flag.
          </>
        }
        needs={
          <>
            For the tab: a `kind` on the composition, or a second read beside
            it. For the toggle: `ManifestBlock.optional: boolean` and
            `included: boolean`, plus the endpoint that writes the second —
            omitting a block only in the browser would sign a sheet the server
            never composed.
          </>
        }
      />
    </nav>
  );
}
