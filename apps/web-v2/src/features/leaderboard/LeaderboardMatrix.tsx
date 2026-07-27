import type { LeaderboardResponse } from "@titlepipe/contract";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

type Cell = LeaderboardResponse["cells"][number];

/**
 * Engine × (jurisdiction · section). Never one column, never one number.
 *
 * TWO EMPTY CELLS THAT MEAN DIFFERENT THINGS, and keeping them apart is the
 * whole job of `cellLabel`:
 *   NO TRUTH YET — golden coverage too thin to score. NOT a zero. A blank
 *                  sitting next to numbers reads as "worst", so it says so.
 *   —            — the engine never declared this capability. Not a failure;
 *                  something it does not claim to do. A faked score here is
 *                  the declared-not-faked principle in its original home.
 */
export function LeaderboardMatrix({
  cells,
  onSelect,
}: {
  cells: readonly Cell[];
  onSelect: (jurisdiction: string, section: string, engineId: string) => void;
}) {
  const engines = [...new Set(cells.map((c) => c.engine_id))];
  const columns = [
    ...new Map(cells.map((c) => [`${c.jurisdiction}|${c.section}`, c])).values(),
  ];

  return (
    <Card>
      <CardHeader filled>
        <Eyebrow variant="section">By jurisdiction and section</Eyebrow>
      </CardHeader>
      <CardBody className="overflow-x-auto p-0">
        <table className="w-full">
          <thead>
            <tr>
              <th className="px-6 py-5 text-left">
                <Eyebrow variant="field">Engine</Eyebrow>
              </th>
              {columns.map((col) => (
                <th key={`${col.jurisdiction}|${col.section}`} className="px-6 py-5 text-left">
                  <Eyebrow variant="field">{col.jurisdiction}</Eyebrow>
                  <span className="mt-1 block font-mono text-xs text-ink-muted">
                    {col.section}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {engines.map((engine) => (
              <tr key={engine} className="border-t border-line-subtle">
                <td className="px-6 py-5 font-mono text-base text-ink-primary">{engine}</td>
                {columns.map((col) => {
                  const cell = cells.find(
                    (c) =>
                      c.engine_id === engine &&
                      c.jurisdiction === col.jurisdiction &&
                      c.section === col.section,
                  );
                  const id = `lb-${engine}-${col.jurisdiction}-${col.section}`;
                  return (
                    <td key={id} className="px-6 py-5">
                      <button
                        type="button"
                        data-testid={id}
                        onClick={() => onSelect(col.jurisdiction, col.section, engine)}
                        className="font-mono text-base text-ink-primary"
                      >
                        {cellLabel(cell)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}

function cellLabel(cell: Cell | undefined): string {
  if (!cell) return "—";
  if (cell.no_truth_yet) return "NO TRUTH YET";
  if (cell.accuracy_by_tag === null) return "—";
  const ruled = cell.accuracy_by_tag["ruled"];
  return ruled === undefined ? "—" : `${Math.round(ruled * 100)}% ruled`;
}
