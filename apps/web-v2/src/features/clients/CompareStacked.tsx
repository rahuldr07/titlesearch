import { Card } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { cn } from "../../shared/ui/classNames";

import { BASELINE_LINES, lineNumber } from "./baseline";
import {
  addedFor, deltaCount, markFor, markLabel, markSymbol, stackedCountLabel,
  type CompareMark,
} from "./compare";
import type { ClientRecord } from "./registry";

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
 */
export function CompareStacked({ clients }: { clients: readonly ClientRecord[] }) {
  return (
    <div className="flex flex-col gap-5">
      {clients.map((c) => {
        const deltas = BASELINE_LINES.filter((l) => markFor(c.id, l.n) !== "baseline");
        return (
          <Card key={c.id} data-testid={`stacked-${c.id}`}>
            <div className="flex flex-wrap items-baseline gap-5 border-b border-line-subtle px-7 py-5">
              <p className="min-w-0 flex-1 text-md font-bold text-ink-primary">{c.name}</p>
              <p className="text-xs font-semibold text-action">{stackedCountLabel(c.id)}</p>
            </div>

            {deltas.map((l) => {
              const mark = markFor(c.id, l.n);
              return (
                <div
                  key={l.n}
                  className="flex items-start gap-5 border-t border-line-subtle px-7 py-5"
                >
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
                        {lineNumber(l.n)}
                      </span>
                      <span className="min-w-0 flex-1 text-sm leading-close text-ink-primary">
                        {l.label}
                      </span>
                      {l.loadBearing ? (
                        <Chip tone="halt" size="micro" bordered>load-bearing</Chip>
                      ) : null}
                    </div>
                    <p className="mt-1 text-tiny font-semibold text-ink-secondary">
                      {markLabel(mark)}
                    </p>
                  </div>
                </div>
              );
            })}

            {addedFor(c.id).map((line) => (
              <div
                key={line.key}
                className="flex items-start gap-5 border-t border-line-subtle px-7 py-5"
              >
                <span
                  className={cn(
                    "flex size-13 shrink-0 items-center justify-center rounded-4 border border-line-strong text-md font-bold",
                    MARK.added,
                  )}
                >
                  {markSymbol("added")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-close text-ink-primary">{line.label}</p>
                  <p className="mt-1 text-tiny font-semibold text-ink-secondary">
                    {markLabel("added")}
                  </p>
                </div>
              </div>
            ))}

            {deltaCount(c.id) === 0 ? (
              <p className="px-7 py-5 text-xs italic text-ink-muted">
                Nothing special about this client — every line as the baseline
                states it.
              </p>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
