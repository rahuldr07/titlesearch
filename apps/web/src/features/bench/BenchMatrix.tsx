import type { BenchCell } from "@titlepipe/contract";
import { Empty, Table, type TableColumn } from "../../components/ui";
import { MatrixCell, type MatrixRow } from "./MatrixCell";

/**
 * THE SECTION × TAG MATRIX — the finding, per `endpoints.ts:336-339`.
 *
 * The two axes are the whole point. A field's SECTION says where in the report
 * it lives; its TAG says how the golden value earned its authority
 * (`delivered_report` / `ruled` / `suspect` / `agreed`, `enums.ts:88`). A miss
 * against a `ruled` seed is a rule the model is breaking; a miss against a
 * `suspect` seed may be the seed being wrong. Collapsing the tag axis would
 * merge those two into one number and destroy the only thing that tells them
 * apart — which is precisely why the contract carries no such number.
 *
 * ══ EVERY CELL PRINTS TWO INTEGERS, NEVER A RATIO ══════════════════════════
 *
 * `passed` and `fields`, as the server sent them. No division happens in this
 * directory. A percentage would be a value the server did not state, and
 * AGENTS.md's "never emit a value you can't cite" applies to a derived figure
 * as much as to an extracted one — with the extra hazard that 1/2 and 500/1000
 * render identically as 50%, and on a bench where `judgments_liens` carries a
 * nine-field seed that difference is the entire caveat.
 *
 * ══ THE AXES ARE THE SERVER'S ORDER ════════════════════════════════════════
 *
 * Rows and columns appear in the order the cells arrive, and there is no
 * sortable header. A table a reader can sort by pass count is a ranking device,
 * and a ranking of sections by score is an aggregate headline drawn one column
 * at a time. The server decides the order; the browser draws it.
 *
 * Tag column headers print the server's enum member verbatim
 * (`delivered_report`, not "Delivered report"). `check-rules.mjs` makes the
 * point about the opposite direction — a server identifier re-cased for
 * decoration "stops matching the string in the rulebook they would search for"
 * — and the same holds for prettifying: the tag is what a reviewer greps.
 */
export function BenchMatrix({ cells }: { readonly cells: readonly BenchCell[] }) {
  const rows: MatrixRow[] = [];
  const tags: string[] = [];

  for (const cell of cells) {
    if (!tags.includes(cell.tag)) tags.push(cell.tag);
    const existing = rows.find((row) => row.section === cell.section);
    if (existing === undefined) {
      rows.push({ section: cell.section, byTag: new Map([[cell.tag, cell]]) });
    } else {
      existing.byTag.set(cell.tag, cell);
    }
  }

  const columns: TableColumn<MatrixRow>[] = [
    {
      id: "section",
      header: "Section",
      width: "minmax(0,1.6fr)",
      cell: (row) => (
        <span className="truncate font-mono text-meta leading-close text-ink-primary">
          {row.section}
        </span>
      ),
    },
    ...tags.map((tag) => ({
      id: tag,
      header: tag,
      width: "minmax(0,1fr)",
      cell: (row: MatrixRow) => <MatrixCell cell={row.byTag.get(tag)} />,
    })),
  ];

  return (
    <section aria-labelledby="bench-matrix-heading" className="flex min-h-0 flex-col gap-6">
      <h2
        id="bench-matrix-heading"
        className="text-label font-bold leading-flat text-ink-muted"
      >
        Passed of fields, by section and golden tag
      </h2>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-line-strong bg-surface-panel">
        <Table
          label="Bench results by section and golden tag"
          rows={rows}
          columns={columns}
          rowKey={(row) => row.section}
          empty={
            <Empty
              title="No cells in this run"
              reason="The run returned no section × tag cells. That is the run's own answer, not a filter — nothing on this screen narrows it."
            />
          }
        />
      </div>
    </section>
  );
}
