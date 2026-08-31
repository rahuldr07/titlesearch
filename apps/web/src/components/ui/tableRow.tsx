import { cx } from "./cx";
import { ALIGN_CLASS, type TableColumn } from "./tableColumns";

/**
 * The header row and the data row; table.tsx is the mechanism, this is the
 * chrome. ROW_HEIGHT lives here because it is a fact about how a row is
 * drawn — 44px, comfortably above WCAG 2.5.8's 24px target minimum, which
 * matters because a row is clickable.
 */
export const ROW_HEIGHT = 44;

/**
 * The header: sticky, on control-fill with a line-strong rule beneath, at
 * the 11px w700 label rung in sentence case.
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
 * One row. `onActivate` is a wider mouse target, not a new focus stop: the
 * row stays role="row" with tabIndex={-1} and never becomes a link or a
 * button, so the `Open →` control inside stays a first-class target and the
 * keyboard path is that control, which is tab-reachable on its own. A row
 * with no such control inside should not be given `onActivate` — the action
 * would exist for a mouse and for nobody else.
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
