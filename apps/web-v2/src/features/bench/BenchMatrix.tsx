import type { BenchCell } from "@titlepipe/contract";
import { cn } from "../../shared/ui/classNames";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * THE TWO AXES ARE THE FINDING. Section × tag, and no total anywhere.
 *
 * A single headline number is the thing this screen exists to refuse: "94%
 * across all fields" hides the one field at 30% that ships defects, and it
 * hides that a quarter of the suspect-seed cells are failing because the SEED
 * is wrong. Both facts are only visible as a grid.
 *
 * ROWS AND COLUMNS ARE DERIVED FROM THE DATA, never hardcoded. `GoldenTag` has
 * four members and the server currently sends three; a hardcoded column list
 * would silently drop the fourth the day it arrives.
 */
function order<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/** A cell reads `{fields}f · {passed}/{fields}` — the denominator stays visible. */
function cellText(cell: BenchCell): string {
  return `${cell.fields}f · ${cell.passed}/${cell.fields}`;
}

function cellTone(cell: BenchCell): string {
  if (cell.passed === cell.fields) return "text-state-settled-ink";
  if (cell.tag === "suspect") {
    return "border-dashed border-state-attend-border bg-state-attend-surface text-state-attend-ink";
  }
  if (cell.tag === "ruled") {
    return "border-state-halt-border bg-state-halt-surface font-bold text-state-halt-ink";
  }
  return "text-state-halt-ink";
}

export function BenchMatrix({ cells }: { cells: readonly BenchCell[] }) {
  const sections = order(cells.map((c) => c.section));
  const tags = order(cells.map((c) => c.tag));

  return (
    <section className="flex flex-col gap-4">
      <Eyebrow variant="section">
        Section × tag. The two axes are the finding; no single number is.
      </Eyebrow>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <th className="p-3" />
              {tags.map((tag) => (
                <th key={tag} className="p-3 font-mono text-micro tracking-badge text-ink-muted">
                  {tag}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <tr key={section}>
                <th className="p-3 text-left font-mono text-xs font-semibold text-ink-primary">
                  {section}
                </th>
                {tags.map((tag) => {
                  const cell = cells.find((c) => c.section === section && c.tag === tag);
                  if (cell === undefined) {
                    return (
                      <td key={tag} className="p-3 font-mono text-xs text-ink-muted">
                        —
                      </td>
                    );
                  }
                  return (
                    <td key={tag} className="p-1">
                      <span
                        data-testid={`cell-${section}-${tag}`}
                        className={cn(
                          "block rounded-3 border border-transparent px-3 py-2 font-mono text-xs",
                          cellTone(cell),
                        )}
                      >
                        {cellText(cell)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="max-w-4xl text-xs leading-body text-ink-muted">
        <span className="font-semibold">judgments_liens × suspect</span> is the
        cell to learn to ignore until the blind fifty lands.{" "}
        <span className="font-semibold">ruled</span> failures are always
        actionable — the seed is authoritative there. location.zip is
        ORDER_SUPPLIED: absent from this screen and every denominator, not
        greyed, not zero.
      </p>
    </section>
  );
}
