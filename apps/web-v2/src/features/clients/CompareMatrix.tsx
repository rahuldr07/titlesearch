import { Card, CardFooter } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { cn } from "../../shared/ui/classNames";

import { BASELINE_LINES, lineNumber } from "./baseline";
import { addedFor, deltaLabel, markFor, markLabel, markSymbol, type CompareMark } from "./compare";
import type { ClientRecord } from "./registry";

const CELL: Readonly<Record<CompareMark, string>> = {
  baseline: "text-ink-muted",
  narrowed: "bg-state-attend-surface font-bold text-state-attend-ink",
  replaced: "bg-action-surface font-bold text-action-ink",
  waived: "bg-state-halt-surface font-bold text-state-halt-ink",
  added: "bg-state-settled-surface font-bold text-state-settled-ink",
};

const COL = "w-52 shrink-0 border-l border-line-subtle";

/**
 * Every active client against one baseline, in one grid.
 *
 * The grid exists because per-client screens answer "what does this client
 * want" and nobody ever asks that in isolation — the real question is "who is
 * different, and about what". Reading two clients by tabbing between two pages
 * makes that a memory exercise.
 *
 * The footer names the case worth arguing about rather than leaving you to
 * spot it: a LOAD-BEARING line waived by a client. Everything else on this grid
 * is a preference; that one changes what the delivered search claims.
 */
export function CompareMatrix({
  clients,
  productName,
}: {
  clients: readonly ClientRecord[];
  productName: string;
}) {
  return (
    <Card className="overflow-x-auto">
      <div className="min-w-300">
        <div className="flex border-b border-line-strong">
          <Eyebrow variant="field" className="min-w-105 flex-1 px-7 py-5">
            Sign-off line · {productName} baseline
          </Eyebrow>
          {clients.map((c) => (
            <div key={c.id} className={cn(COL, "px-3 py-4 text-center")}>
              <p className="text-xs font-bold leading-tight text-ink-primary">{c.name}</p>
              <p className="mt-1 text-tiny font-semibold text-action">{deltaLabel(c.id)}</p>
            </div>
          ))}
        </div>

        {BASELINE_LINES.map((l) => (
          <div key={l.n} className="flex items-stretch border-t border-line-subtle">
            <div className="flex min-w-105 flex-1 items-baseline gap-5 px-7 py-5">
              <span className="shrink-0 font-mono text-tiny font-semibold text-ink-muted">
                {lineNumber(l.n)}
              </span>
              <span className="flex-1 text-sm leading-close text-ink-primary">{l.label}</span>
              {l.loadBearing ? (
                <Chip tone="halt" size="micro" bordered className="shrink-0">
                  load-bearing
                </Chip>
              ) : null}
            </div>
            {clients.map((c) => {
              const mark = markFor(c.id, l.n);
              return (
                <div
                  key={c.id}
                  title={`${c.name} — ${markLabel(mark)}`}
                  className={cn(COL, "flex items-center justify-center text-md", CELL[mark])}
                >
                  {markSymbol(mark)}
                </div>
              );
            })}
          </div>
        ))}

        {clients.flatMap((owner) =>
          addedFor(owner.id).map((line) => (
            <div
              key={line.key}
              className="flex items-stretch border-t border-line-subtle bg-surface-sunken"
            >
              <div className="flex min-w-105 flex-1 items-baseline gap-5 px-7 py-5">
                <span className="shrink-0 font-mono text-tiny font-semibold text-state-settled-ink">
                  ＋
                </span>
                <span className="flex-1 text-sm leading-close text-ink-primary">
                  {line.label}
                </span>
                <span className="shrink-0 text-tiny text-ink-muted">only {owner.name}</span>
              </div>
              {clients.map((c) => (
                <div
                  key={c.id}
                  title={
                    c.id === owner.id
                      ? `${c.name} — ${markLabel("added")}`
                      : `${c.name} — not on their list`
                  }
                  className={cn(
                    COL,
                    "flex items-center justify-center text-md",
                    c.id === owner.id ? CELL.added : "",
                  )}
                >
                  {c.id === owner.id ? markSymbol("added") : ""}
                </div>
              ))}
            </div>
          )),
        )}
      </div>

      <CardFooter className="leading-body">
        Resolved through the same function intake uses, so this matrix cannot
        disagree with what an order actually gets. A{" "}
        <span className="font-semibold text-state-halt-ink">load-bearing</span> line
        waived by a client is the case worth arguing about — open that client to
        see the conflict and its acknowledgement.
      </CardFooter>
    </Card>
  );
}
