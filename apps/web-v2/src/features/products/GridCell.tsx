import { Button } from "../../shared/ui/Button";
import { cn } from "../../shared/ui/classNames";

import { CELL_MARKS, type CellMark } from "./lines";

/**
 * One product × one line, as THREE VISIBLE CHOICES rather than a cycling
 * toggle.
 *
 * The design's own control cycles ● → ◐ → —, and that is wrong for this cell:
 * the three states are not a progression, and a cycling control means you
 * cannot see what the other options are without changing the value to find
 * out. Laying all three out costs width and buys a cell you can read at a
 * glance and set in one click.
 *
 * The marks stay distinguishable without colour — a filled disc, a half disc
 * and a dash — because this grid is the one place where "applies" and
 * "narrowed" being confused changes what a search is required to cover.
 */
const SELECTED: Record<CellMark, string> = {
  applies: "border-state-settled bg-state-settled text-ink-on-action",
  narrowed: "border-state-attend bg-state-attend text-ink-on-action",
  na: "border-ink-muted bg-ink-muted text-ink-on-action",
};

const RESTING: Record<CellMark, string> = {
  applies: "border-line-strong text-state-settled-ink",
  narrowed: "border-line-strong text-state-attend-ink",
  na: "border-line-strong text-ink-muted",
};

export function GridCell({
  value,
  rowLabel,
  columnName,
  disabled,
  onSet,
}: {
  value: CellMark;
  rowLabel: string;
  columnName: string;
  disabled: boolean;
  onSet: (mark: CellMark) => void;
}) {
  return (
    <div className="flex w-42 shrink-0 items-center justify-center gap-1 border-l border-line-subtle px-2 py-3">
      {CELL_MARKS.map((mark) => (
        <Button
          key={mark.value}
          size="sm"
          fill="outlined"
          tone="neutral"
          disabled={disabled}
          aria-pressed={value === mark.value}
          aria-label={`${columnName} · ${rowLabel} — ${mark.label}`}
          className={cn(
            "size-11 border p-0 text-sm rounded-3",
            value === mark.value ? SELECTED[mark.value] : RESTING[mark.value],
          )}
          onClick={() => onSet(mark.value)}
        >
          {mark.symbol}
        </Button>
      ))}
    </div>
  );
}
