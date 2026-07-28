import { useState } from "react";

import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

import { PRODUCTS, type Derivation } from "./catalogue";
import { GridRow } from "./GridRow";
import { SIGNOFF_LINES, type CellMark, type SignoffLine } from "./lines";

const COLUMNS = PRODUCTS.filter((p) => !p.retired);
const ROWS = SIGNOFF_LINES.filter((l) => !l.retired);
const GRID_KEYS: readonly Derivation[] = ["cos", "tos", "update", "y"];

const KEY_LABEL: Record<Derivation, string> = {
  cos: "COS", tos: "TOS", update: "Update", y: "Year products",
};
const MARK_LABEL: Record<CellMark, string> = {
  applies: "applies", narrowed: "narrowed", na: "n/a",
};

type Draft = Readonly<Record<string, CellMark>>;

const cellKey = (line: SignoffLine, column: Derivation) => `${line.id}:${column}`;

function marksFor(line: SignoffLine, draft: Draft): Record<Derivation, CellMark> {
  return {
    cos: draft[cellKey(line, "cos")] ?? line.cells.cos,
    tos: draft[cellKey(line, "tos")] ?? line.cells.tos,
    update: draft[cellKey(line, "update")] ?? line.cells.update,
    y: draft[cellKey(line, "y")] ?? line.cells.y,
  };
}

/**
 * The baseline: which lines each product asks for, in one grid.
 *
 * Edits accumulate as a LOCAL DRAFT and change nothing until publish, because
 * the unit of change here is the batch, not the cell. Publishing cell-by-cell
 * would mint a config version per click and leave orders stamped against
 * half-applied intent — a search required to cover the new scope but not yet
 * excused from the old one.
 *
 * The pending list is spelled out in words ("applies → narrowed"), not as a
 * count. A number tells you something changed; only the sentence tells you
 * whether it is what you meant, and this is the last screen before that becomes
 * an obligation on somebody's search.
 */
export function BaselineGrid({ canAuthor }: { canAuthor: boolean }) {
  const [draft, setDraft] = useState<Draft>({});

  const changes = ROWS.flatMap((line) =>
    GRID_KEYS.flatMap((column) => {
      const next = draft[cellKey(line, column)];
      const was = line.cells[column];
      return next === undefined || next === was
        ? []
        : [{
            id: cellKey(line, column),
            text: `Line ${line.n} · ${KEY_LABEL[column]}: ${MARK_LABEL[was]} → ${MARK_LABEL[next]}`,
          }];
    }),
  );

  return (
    <section className="flex flex-col gap-6">
      <p className="text-xs leading-body text-ink-muted">
        Set each cell directly — <span className="font-bold text-state-settled-ink">●</span>{" "}
        applies · <span className="font-bold text-state-attend-ink">◐</span> narrowed ·{" "}
        <span className="font-bold text-ink-muted">—</span> n/a. Narrowed reveals
        the scope text. Edit freely; nothing changes until you{" "}
        <span className="font-semibold">publish</span> — one config version for
        the whole batch.
      </p>

      {changes.length === 0 ? null : (
        <div
          data-testid="grid-pending"
          className="rounded-9 border border-action-border bg-action-surface px-8 py-6"
        >
          <div className="flex flex-wrap items-center gap-5">
            <p className="text-sm font-semibold text-action-ink">
              {changes.length} unpublished cell change(s)
            </p>
            <div className="ml-auto flex gap-4">
              <Button
                fill="outlined"
                tone="neutral"
                data-testid="grid-discard"
                onClick={() => setDraft({})}
              >
                Discard
              </Button>
              {/* CONTRACT GAP: publishing mints a config version server-side; no endpoint exists. */}
              <Button data-testid="grid-publish" disabled>
                Publish → new config version
              </Button>
            </div>
          </div>
          <ul className="mt-4 flex flex-col gap-1">
            {changes.map((c) => (
              <li key={c.id} className="font-mono text-xs text-ink-secondary">{c.text}</li>
            ))}
          </ul>
        </div>
      )}

      <Card className="overflow-x-auto">
        <div className="min-w-380">
          <div className="flex border-b border-line-strong">
            <Eyebrow variant="field" className="min-w-110 flex-1 px-7 py-5">
              Sign-off line
            </Eyebrow>
            {COLUMNS.map((p) => (
              <div
                key={p.id}
                className="w-42 shrink-0 border-l border-line-subtle px-2 py-5 text-center text-tiny font-bold text-ink-secondary"
              >
                {p.code}
              </div>
            ))}
          </div>
          {ROWS.map((line) => (
            <GridRow
              key={line.id}
              line={line}
              marks={marksFor(line, draft)}
              columns={COLUMNS}
              canAuthor={canAuthor}
              onSet={(column, mark) =>
                setDraft((d) => ({ ...d, [cellKey(line, column)]: mark }))
              }
            />
          ))}
        </div>
      </Card>

      <p className="text-xs leading-body text-ink-muted">
        CONTRACT GAP: no baseline-grid endpoint exists. The draft above is local
        only — it survives nothing, publishes nothing, and the scope fields are
        not persisted.
      </p>
    </section>
  );
}
