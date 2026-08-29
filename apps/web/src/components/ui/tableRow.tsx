import { cx } from "./cx";
import { ALIGN_CLASS, type TableColumn } from "./tableColumns";

/**
 * THE HEADER ROW AND THE DATA ROW, SPLIT OUT SO `table.tsx` IS THE MECHANISM
 * AND THIS IS THE CHROME.
 *
 * `ROW_HEIGHT` lives here rather than in `table.tsx` because it is a fact
 * about how a row is DRAWN, and the virtualizer is merely the thing that has
 * to be told. 44px is `--size-control-2xl` and is comfortably above WCAG
 * 2.5.8's 24px target minimum, which matters because a row is clickable.
 */
export const ROW_HEIGHT = 44;

/**
 * The header. Sticky, on `--color-control-fill` with a `--color-line-strong`
 * rule beneath — RECIPES.md §Card's header row, at the 11px w700 label rung in
 * sentence case (rule 4: ALL-CAPS is legal only on rail rubrics and serif
 * certificate headings, and this is neither).
 */
export function TableHeaderRow<TRow>({
  columns,
  template,
}: {
  readonly columns: readonly TableColumn<TRow>[];
  readonly template: string;
}) {
  return (
    <div
      role="row"
      aria-rowindex={1}
      data-slot="table-header"
      className="tp-z-raised sticky top-0 grid border-b border-line-strong bg-control-fill"
      style={{ gridTemplateColumns: template }} /* rules-allow: the column track list is caller data (tableColumns.tsx) with no fixed value set a utility could enumerate */
    >
      {columns.map((column) => (
        <div
          key={column.id}
          role="columnheader"
          className={cx(
            "truncate px-8 py-5 font-sans text-label leading-flat font-bold text-ink-muted",
            ALIGN_CLASS[column.align ?? "start"],
          )}
        >
          {column.header}
        </div>
      ))}
    </div>
  );
}

/** Anything that answers a click on its own account and must keep it. */
const OWN_TARGET = "a,button,input,select,textarea,[role='button'],[role='link']";

/**
 * One row. Hover lifts to `--color-row-hover` and NOTHING else moves.
 *
 * ══ `onActivate` IS A WIDER MOUSE TARGET, NOT A NEW FOCUS STOP ═════════════
 *
 * The row stays `role="row"` with `tabIndex={-1}`. It does NOT become a link or
 * a button, which is the whole point: the design puts an `Open →` control
 * inside the row, and an interactive element nested in a link is the defect the
 * Overview's recent-orders table had to work around with a positioned overlay.
 * A div carrying a click handler wraps nothing interactive, so the inner
 * control stays a first-class target.
 *
 * It also stays out of the tab sequence deliberately — `table.tsx` explains why
 * 5,000 rows are not a tab ring, and the container holds the stop. So the
 * KEYBOARD path to this action is the inner control, which is tab-reachable on
 * its own; the row is the redundant, wider target a mouse gets. A row with no
 * such control inside it should not be given `onActivate`, because then the
 * action would exist for a mouse and for nobody else.
 */
export function TableRow<TRow>({
  row,
  columns,
  template,
  index,
  offset,
  onActivate,
}: {
  readonly row: TRow;
  readonly columns: readonly TableColumn<TRow>[];
  readonly template: string;
  readonly index: number;
  readonly offset: number;
  readonly onActivate?: ((row: TRow) => void) | undefined;
}) {
  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      tabIndex={-1}
      data-slot="table-row"
      data-activatable={onActivate === undefined ? undefined : ""}
      onClick={
        onActivate === undefined
          ? undefined
          : (event) => {
              // A click that a control inside the row already answers is that
              // control's, never the row's.
              if ((event.target as HTMLElement).closest(OWN_TARGET) !== null) return;
              onActivate(row);
            }
      }
      className={cx(
        "tp-state tp-ring absolute top-0 left-0 grid w-full items-center",
        "border-b border-line-subtle hover:bg-row-hover",
        onActivate !== undefined && "cursor-pointer",
      )}
      style={{ gridTemplateColumns: template, height: ROW_HEIGHT, transform: `translateY(${offset}px)` }} /* rules-allow: the Y offset comes from the virtualizer per frame and the track list is caller data; neither is expressible as a class */
    >
      {columns.map((column) => (
        <div
          key={column.id}
          role="gridcell"
          data-column={column.id}
          className={cx(
            "truncate px-8 font-sans text-body leading-close text-ink-primary",
            ALIGN_CLASS[column.align ?? "start"],
          )}
        >
          {column.cell(row)}
        </div>
      ))}
    </div>
  );
}
