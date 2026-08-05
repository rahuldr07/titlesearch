import type { ConfigLine, ConfigProduct, LineApplication } from "@titlepipe/contract";

import { Eyebrow } from "../../shared/ui/Eyebrow";
import { TextField } from "../../shared/ui/TextField";

import { GridCell } from "./GridCell";

/**
 * A line across every product, plus the scope text a narrowing owes.
 *
 * NARROWED WITHOUT SCOPE TEXT IS THE DEFECT THIS ROW EXISTS TO PREVENT. "◐"
 * says the line applies but not to everything, and a narrowing nobody wrote
 * down is indistinguishable at intake from a line that simply applies — so the
 * scope field appears attached to the row the moment a cell goes narrowed,
 * rather than behind a second click somewhere else.
 *
 * Cells are keyed by PRODUCT ID, which is how the server sends them: one column
 * per product, and a product with no cell of its own is excluded rather than
 * quietly inheriting a neighbour's.
 */
export function GridRow({
  line,
  marks,
  columns,
  canAuthor,
  onSet,
}: {
  line: ConfigLine;
  marks: Readonly<Record<string, LineApplication>>;
  columns: readonly ConfigProduct[];
  canAuthor: boolean;
  onSet: (productId: string, mark: LineApplication) => void;
}) {
  const narrowed = columns.filter((p) => marks[p.id] === "narrowed");

  return (
    <div data-testid={`grid-row-${line.id}`}>
      <div className="flex items-stretch border-t border-line-subtle">
        <div className="flex min-w-110 flex-1 items-baseline gap-4 px-7 py-5">
          <span className="shrink-0 font-mono text-tiny font-semibold text-ink-muted">
            {line.n}
          </span>
          <span className="text-sm leading-close text-ink-primary">{line.label}</span>
        </div>
        {columns.map((p) => (
          <GridCell
            key={p.id}
            value={marks[p.id] ?? "excluded"}
            rowLabel={line.label}
            columnName={p.code}
            disabled={!canAuthor}
            onSet={(mark) => onSet(p.id, mark)}
          />
        ))}
      </div>

      {canAuthor && narrowed.length > 0 ? (
        <div className="border-t border-dashed border-line-subtle bg-state-attend-surface px-7 py-4">
          {narrowed.map((p) => (
            <div key={p.id} className="mb-3 flex items-center gap-5 last:mb-0">
              <Eyebrow variant="caption" tone="attend" className="w-30 shrink-0">
                {p.code} ◐
              </Eyebrow>
              <TextField
                size="sm"
                tone="attend"
                defaultValue={line.scope[p.id] ?? ""}
                placeholder="Scope text for this product & line"
                aria-label={`Scope text — ${p.code} · ${line.label}`}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
