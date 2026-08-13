import { Card, CardHeader } from "../../shared/ui/Card";
import { EmptyNote } from "../../shared/ui/EmptyPanel";
import { DividedSection, ListRow } from "../../shared/ui/ListRow";
import { cn } from "../../shared/ui/classNames";

import {
  deltasOf,
  markLabel,
  markOf,
  markSymbol,
  stackedCountLabel,
  type CompareColumn,
  type CompareMark,
} from "./compare";

const MARK: Readonly<Record<CompareMark, string>> = {
  baseline: "bg-surface-app text-ink-muted",
  narrowed: "bg-state-attend-surface text-state-attend-ink",
  replaced: "bg-action-surface text-action-ink",
  waived: "bg-state-halt-surface text-state-halt-ink",
  added: "bg-state-settled-surface text-state-settled-ink",
};

/**
 * The same resolved data, re-cut one block per client.
 *
 * A 13 × N grid is unreadable under about 900px, and the honest response to
 * that is to change the CUT, not to shrink the type or let the page scroll
 * sideways on a phone. Same source, same marks, same counts — this lists only
 * each client's deltas, which is what the grid was being read for anyway.
 *
 * A client with nothing special gets a sentence saying so rather than an empty
 * card. Empty reads as "not loaded"; the sentence reads as "resolved, and there
 * is nothing here", and those are different facts.
 *
 * THE HEADER BAND AND THE FIRST ROW USED TO DRAW TWO HAIRLINES — the band's own
 * `border-b` and the row's `border-t` stacked at the same junction, which reads
 * as a rule rather than a separator. `CardHeader` plus a `DividedSection` puts
 * the first-child exemption where the DOM can be trusted to honour it, so the
 * junction is one line whether or not this client has any deltas.
 */
export function CompareStacked({ columns }: { columns: readonly CompareColumn[] }) {
  return (
    <div className="flex flex-col gap-5">
      {columns.map((c) => {
        const deltas = deltasOf(c.checklist.lines, c.client.overrides);
        return (
          <Card key={c.client.id} data-testid={`stacked-${c.client.id}`}>
            <CardHeader className="flex-wrap items-baseline gap-5">
              <p className="min-w-0 flex-1 text-md font-bold text-ink-primary">
                {c.client.name}
              </p>
              <p className="text-xs font-semibold text-action">
                {stackedCountLabel(deltas.length)}
              </p>
            </CardHeader>

            {deltas.length > 0 ? (
              <DividedSection>
                {deltas.map((line) => {
                  const mark = markOf(line, c.client.overrides);
                  return (
                    <ListRow key={line.line_id} className="flex items-start gap-5">
                      <span
                        className={cn(
                          "flex size-13 shrink-0 items-center justify-center rounded-4 border border-line-strong text-md font-bold",
                          MARK[mark],
                        )}
                      >
                        {markSymbol(mark)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-4">
                          <span className="font-mono text-tiny font-semibold text-ink-muted">
                            {line.line_id}
                          </span>
                          <span className="min-w-0 flex-1 text-sm leading-close text-ink-primary">
                            {line.label}
                          </span>
                        </div>
                        <p className="mt-1 text-tiny font-semibold text-ink-secondary">
                          {markLabel(mark)}
                          {line.scope_note === null ? "" : ` · ${line.scope_note}`}
                        </p>
                      </div>
                    </ListRow>
                  );
                })}
              </DividedSection>
            ) : (
              /* The list element itself is dropped, not just emptied: a `<ul>`
                 with no `<li>` is announced as a list of zero items on top of
                 the sentence that already says so. */
              <div className="px-8 py-6">
                <EmptyNote>
                  Nothing special about this client — every line as the baseline states
                  it.
                </EmptyNote>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
