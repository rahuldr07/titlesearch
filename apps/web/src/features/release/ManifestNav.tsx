import type { ManifestBlock } from "@titlepipe/contract";

/**
 * THE MANIFEST INDEX — one row per block the server composed, in the server's
 * own order, under the server's own numerals.
 *
 * The per-block figures are printed as the two numbers they are (`cited` of
 * `field_count`) and carry NO mark. A ✓/◆ here would be this screen deciding
 * that a block is short of citations, and no such verdict exists on the wire —
 * the gates are where citation coverage is adjudicated, by the server.
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
              {/* Rule 3: a block numeral is an identifier on a record. */}
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
    </nav>
  );
}
