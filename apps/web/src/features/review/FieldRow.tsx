import type { Field } from "@titlepipe/contract";
import { readCited } from "../../shared/provenance";
import { cx } from "../../components/ui";
import { fieldLabel } from "./fieldNaming";
import { readingsDisagree } from "./readings";
import { RowValue } from "./RowValue";
import { RowMark } from "./RowMark";
import { T1Pill } from "./T1Pill";

/**
 * One field row — the `140px / 1fr / 70px / 24px` grid. Label, value mono,
 * cite mono grey, mark.
 */
export type FieldRowProps = {
  readonly field: Field;
  readonly selected: boolean;
  readonly onSelect: () => void;
  /**
   * Preview this field's citation on the sheet across the split. Hover AND
   * focus, because a reviewer moving by J/K must get the same page a mouse
   * would — the design's own note under the sheet promises both. It is a
   * view ask and nothing else: no selection, no write, and the value on
   * this row does not change because the pointer crossed it.
   */
  readonly onPreview: () => void;
  /**
   * The end of that ask. Without it the preview was STICKY: `onPreview` had
   * no counterpart, so the last row the pointer ever crossed kept the sheet
   * for the rest of the session and outranked the selected field — the
   * examiner then read a decision against another field's page while the
   * pin under it claimed the selected field cited it.
   */
  readonly onPreviewEnd: () => void;
  readonly onEdit: () => void;
  /**
   * Whether this field carries ruinous exposure. Server-supplied via
   * `rule_refs` — see `T1Pill`, which refuses to decide it.
   */
  readonly ruinous: boolean;
};

export function FieldRow({
  field,
  selected,
  onSelect,
  onPreview,
  onPreviewEnd,
  onEdit,
  ruinous,
}: FieldRowProps) {
  const value = readCited(field);
  /*
   * A≠B: the readings the server sent carry different values — a fact about
   * the payload, not a ruling, and it must surface on the row. Decided in
   * `readings.ts`, which is where touching a reading's `.value` belongs.
   */
  const disagree = readingsDisagree(field.readings ?? []);

  return (
    <button
      type="button"
      data-testid={`row-${field.path}`}
      data-selected={selected}
      onClick={() => {
        onPreview();
        onSelect();
      }}
      onDoubleClick={onEdit}
      onMouseEnter={onPreview}
      onMouseLeave={onPreviewEnd}
      onFocus={onPreview}
      onBlur={onPreviewEnd}
      aria-current={selected ? "true" : undefined}
      className={cx(
        "tp-state grid w-full cursor-pointer items-start gap-6 rounded-lg border border-transparent px-4 py-5 text-left",
        /*
         * The design's four tracks — label / value / cite / mark. A Tailwind
         * arbitrary template, not an inline style (banned, check-rules.mjs
         * §inline-style) and not a `tp-` utility, because no `@utility
         * tp-field-row-grid` was ever declared: the name shipped as a dead
         * class and the rows stacked single-column. Asserted in
         * FieldRow.test.ts so the template cannot silently go missing again.
         */
        "grid-cols-[140px_minmax(0,1fr)_70px_24px]",
        /* The design separates rows by a 4px gap and answers the pointer
           with a border, not by a rule between them. */
        selected ? "bg-action-surface" : "hover:border-action-border hover:bg-row-hover",
      )}
    >
      {/* 140px — the label, with the T1 chip beside it. Mono, the rubric
          register (fieldNaming.ts). */}
      <span className="flex min-w-0 items-center gap-3">
        <span className="truncate text-label leading-flat font-semibold text-ink-muted">
          {fieldLabel(field.path)}
        </span>
        {ruinous && <T1Pill />}
      </span>

      {/* 1fr — the value, with the reading signals under it. */}
      <span className="flex min-w-0 flex-col gap-2">
        <RowValue value={value} />
        {disagree && (
          <span className="flex flex-wrap items-center gap-3">
            <span
              data-testid="row-disagreement"
              className="rounded-sm border border-state-attend-border bg-state-attend-surface px-3 font-mono text-label leading-flat text-state-attend"
            >
              A≠B
            </span>
          </span>
        )}
      </span>

      {/* 70px — the citation, mono grey. Absent is not a dash: a field with no
          citation has already rendered as `uncited` above, loudly. */}
      <span className="truncate text-right font-mono text-label leading-flat text-ink-faint tabular-nums">
        {field.source_page === null ? "" : `p.${field.source_page}`}
      </span>

      {/* 24px — the mark. One status signal per row. */}
      <RowMark field={field} />
    </button>
  );
}
