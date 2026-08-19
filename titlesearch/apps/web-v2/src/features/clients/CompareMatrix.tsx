import type { EffectiveLine } from "@titlepipe/contract";

import { Card, CardFooter } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { cn } from "../../shared/ui/classNames";

import { deltaLabel, deltasOf, type CompareColumn } from "./compare";
import { COL, LABEL_CELL, MarkCell } from "./CompareCell";

/** The union of every resolved line, in line order. */
function rowsOf(columns: readonly CompareColumn[]): readonly EffectiveLine[] {
  const byId = new Map<string, EffectiveLine>();
  for (const c of columns) {
    for (const line of c.checklist.lines) {
      if (!byId.has(line.line_id)) byId.set(line.line_id, line);
    }
  }
  return [...byId.values()].sort((a, b) => a.n - b.n);
}

/**
 * Every resolved client against one baseline, in one grid.
 *
 * The grid exists because per-client screens answer "what does this client
 * want" and nobody ever asks that in isolation — the real question is "who is
 * different, and about what". Reading two clients by tabbing between two pages
 * makes that a memory exercise.
 *
 * A DASH IS NOT A DOT: it means the server's checklist for that client does not
 * carry the line at all, which is a different fact from "resolved, and
 * unchanged". Both are drawn, because the third thing a cell could be — empty —
 * is what a rendering failure looks like, and neither fact may borrow that.
 */
export function CompareMatrix({
  columns,
  productName,
}: {
  columns: readonly CompareColumn[];
  productName: string;
}) {
  return (
    <Card className="relative overflow-x-auto">
      <div className="min-w-300">
        {/*
          THE COLUMN HEADS STAY WITH THE ROWS. Thirteen sign-off lines run
          past the top of the pane, and this grid's cells are single glyphs
          whose only meaning is which CLIENT column they sit in — scroll the
          header away and a "◐" three rows down is unreadable, or worse,
          read against the wrong client. The export pins it (`position:sticky;
          top:0;z-index:3`) with a hairline shadow beneath; the panel ground is
          repeated here because a transparent sticky header lets the rows show
          through it as they pass.
        */}
        <div className="sticky top-0 z-(--z-raised) flex rounded-t-8 border-b border-line-strong bg-surface-panel">
          <Eyebrow variant="field" className={cn(LABEL_CELL, "px-7 py-5")}>
            Sign-off line · {productName} baseline
          </Eyebrow>
          {columns.map((c) => (
            <div key={c.client.id} className={cn(COL, "px-3 py-4 text-center")}>
              <p className="text-xs font-bold leading-tight text-ink-primary">
                {c.client.name}
              </p>
              {/*
                THE OVERRIDE COUNT IS THIS SCREEN'S ONE ACCENT, and the mockup
                sets it in the mono voice — the same register as every other
                counted thing in this direction. Switzer's figures here read as
                a second title line under the client's name; the mono figures
                read as a tally, which is what they are.
              */}
              <p className="mt-1 font-mono text-tiny font-semibold text-action">
                {deltaLabel(deltasOf(c.checklist.lines, c.client.overrides).length)}
              </p>
            </div>
          ))}
        </div>

        {rowsOf(columns).map((row) => (
          <div key={row.line_id} className="flex items-stretch border-t border-line-subtle">
            <div className={cn(LABEL_CELL, "flex items-baseline gap-5 px-7 py-5")}>
              <span className="shrink-0 font-mono text-tiny font-semibold text-ink-muted">
                {row.line_id}
              </span>
              <span className="flex-1 text-sm leading-close text-ink-primary">{row.label}</span>
            </div>
            {columns.map((c) => (
              <MarkCell key={c.client.id} column={c} lineId={row.line_id} />
            ))}
          </div>
        ))}
      </div>

      <CardFooter className="leading-body">
        Resolved through the same function intake uses, so this matrix cannot
        disagree with what an order actually gets. Open a client to see the
        conflict the server raised on its pairing, and its acknowledgement.
        {/*
          CONTRACT GAP: nothing on the wire marks a line LOAD-BEARING, so the
          grid cannot flag the case worth arguing about — an override on a line
          the product's meaning depends on. The server names that per pairing in
          `EffectiveChecklist.conflict`, which only the per-client tab shows.
        */}
      </CardFooter>
    </Card>
  );
}

