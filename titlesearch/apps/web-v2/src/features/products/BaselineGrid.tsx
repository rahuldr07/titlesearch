import type { ConfigLine, ConfigProduct, LineApplication } from "@titlepipe/contract";
import { useState } from "react";

import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

import { applicationFor, applicationLabel } from "./cellMarks";
import { GridRow } from "./GridRow";

type Draft = Readonly<Record<string, LineApplication>>;

const cellKey = (lineId: string, productId: string) => `${lineId}:${productId}`;

function marksFor(
  line: ConfigLine,
  columns: readonly ConfigProduct[],
  draft: Draft,
): Record<string, LineApplication> {
  const marks: Record<string, LineApplication> = {};
  for (const p of columns) {
    marks[p.id] = draft[cellKey(line.id, p.id)] ?? applicationFor(line.cells, p.id);
  }
  return marks;
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
 *
 * THE DRAFT BLOCK IS `tone="action"`, NOT ATTEND. An unpublished draft is not a
 * warning — it is the live thing on this screen. Amber would file it beside the
 * read-only caution and the version notice, and a screen where everything is
 * amber has told you nothing.
 */
export function BaselineGrid({
  products,
  lines,
  canAuthor,
}: {
  products: readonly ConfigProduct[];
  lines: readonly ConfigLine[];
  canAuthor: boolean;
}) {
  const [draft, setDraft] = useState<Draft>({});
  const columns = products.filter((p) => !p.retired);
  const rows = lines.filter((l) => !l.retired);

  const changes = rows.flatMap((line) =>
    columns.flatMap((p) => {
      const next = draft[cellKey(line.id, p.id)];
      const was = applicationFor(line.cells, p.id);
      return next === undefined || next === was
        ? []
        : [{
            id: cellKey(line.id, p.id),
            text: `Line ${line.n} · ${p.code}: ${applicationLabel(was)} → ${applicationLabel(next)}`,
          }];
    }),
  );

  return (
    <section className="flex flex-col gap-6">
      <p className="text-xs leading-body text-ink-muted">
        Set each cell directly — <span className="font-bold text-state-settled-ink">●</span>{" "}
        applies · <span className="font-bold text-state-attend-ink">◐</span> narrowed ·{" "}
        <span className="font-bold text-ink-muted">—</span> excluded. Narrowed
        reveals the scope text. Edit freely; nothing changes until you{" "}
        <span className="font-semibold">publish</span> — one config version for
        the whole batch.
      </p>

      {changes.length === 0 ? null : (
        <Card tone="action" data-testid="grid-pending" className="px-8 py-6">
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
        </Card>
      )}

      <Card className="overflow-x-auto">
        <div className="min-w-380">
          <div className="flex border-b border-line-strong">
            <Eyebrow variant="field" className="min-w-110 flex-1 px-7 py-5">
              Sign-off line
            </Eyebrow>
            {columns.map((p) => (
              <div
                key={p.id}
                className="w-42 shrink-0 border-l border-line-subtle px-2 py-5 text-center text-tiny font-bold text-ink-secondary"
              >
                {p.code}
              </div>
            ))}
          </div>
          {rows.map((line) => (
            <GridRow
              key={line.id}
              line={line}
              marks={marksFor(line, columns, draft)}
              columns={columns}
              canAuthor={canAuthor}
              onSet={(productId, mark) =>
                setDraft((d) => ({ ...d, [cellKey(line.id, productId)]: mark }))
              }
            />
          ))}
        </div>
      </Card>

      <p className="text-xs leading-body text-ink-muted">
        CONTRACT GAP: the grid is served read-only. The draft above is local only
        — it survives nothing, publishes nothing, and the scope fields are not
        persisted.
      </p>
    </section>
  );
}
