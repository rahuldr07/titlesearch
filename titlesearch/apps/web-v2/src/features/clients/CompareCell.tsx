import { cn } from "../../shared/ui/classNames";

import {
  ABSENT_SYMBOL, markLabel, markOf, markSymbol,
  type CompareColumn, type CompareMark,
} from "./compare";

/*
 * ONE VERTICAL RULE, WHERE THE READING CHANGES.
 *
 * RULE: the reskin replaces hairlines with layered paper, and the mockup's
 * matrix draws a single rule — between the sentence you read and the marks you
 * scan — with nothing between the client columns. FAILURE PREVENTED: a rule per
 * column turns thirteen rows of single glyphs into a ledger grid, which is the
 * texture this direction spent its depth tokens getting away from; the marks
 * are already aligned under their heads, so the extra rules separate nothing.
 *
 * Both widths live here rather than in the matrix because the head band, the
 * row label and the cell must agree to the pixel — a column that is `w-52` in
 * the body and anything else in the head puts every glyph under the wrong
 * client, which is the one failure this grid cannot survive.
 */
export const COL = "w-52 shrink-0";
export const LABEL_CELL = "min-w-105 flex-1 border-r border-line-subtle";

/*
 * THE DOT OUTWEIGHS THE DASH.
 *
 * RULE: the baseline dot is a POSITIVE assertion — the server resolved this
 * line and found nothing special — while the dash is an absence, and the
 * mockup draws the assertion at full ink. FAILURE PREVENTED: at the same muted
 * weight the two differ only in shape at 12.5px, and a grid read at a glance
 * would let "resolved, unchanged" and "not on their list" trade places — the
 * one confusion that would make the marks stop being the complete set of
 * differences.
 *
 * The tints are reinforcement, never the message: every mark is already a
 * different SHAPE, so the grid reads in greyscale and to anyone who cannot
 * separate the attend amber from the halt red.
 */
const CELL: Readonly<Record<CompareMark, string>> = {
  baseline: "text-ink-secondary",
  narrowed: "bg-state-attend-surface font-bold text-state-attend-ink",
  replaced: "bg-action-surface font-bold text-action-ink",
  waived: "bg-state-halt-surface font-bold text-state-halt-ink",
  added: "bg-state-settled-surface font-bold text-state-settled-ink",
};

/**
 * One client's answer on one line — the grid's whole vocabulary in one place.
 *
 * THE ABSENT CASE IS DECIDED HERE, ONCE. Whether the client's resolved
 * checklist carries the line at all is the only lookup the matrix does, and it
 * settles three things together: the glyph, its weight, and the sentence a
 * hover reads out. Split across the row loop those three drifted apart — a
 * cell could be given the dash while its title still named a mark, which is a
 * grid that lies quietly to the one reader who stopped to ask it a question.
 */
export function MarkCell({
  column,
  lineId,
}: {
  column: CompareColumn;
  lineId: string;
}) {
  const line = column.checklist.lines.find((l) => l.line_id === lineId);
  const mark = line === undefined ? null : markOf(line, column.client.overrides);
  return (
    <div
      title={
        mark === null
          ? `${column.client.name} — not on their checklist`
          : `${column.client.name} — ${markLabel(mark)}`
      }
      className={cn(
        COL,
        "flex items-center justify-center text-md",
        mark === null ? "text-ink-muted" : CELL[mark],
      )}
    >
      {mark === null ? ABSENT_SYMBOL : markSymbol(mark)}
    </div>
  );
}
