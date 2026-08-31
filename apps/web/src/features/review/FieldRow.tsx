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
   * Whether this field carries ruinous exposure. Server-supplied via
   * `rule_refs` — see `T1Pill`, which refuses to decide it.
   */
  readonly ruinous: boolean;
};

export function FieldRow({ field, selected, onSelect, ruinous }: FieldRowProps) {
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
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cx(
        "tp-state grid w-full cursor-pointer items-start gap-6 border-b border-line-faint px-8 py-5 text-left",
        // The design's four tracks. Written as a grid template class rather
        // than an inline style, which check-rules.mjs bans outright.
        "tp-field-row-grid",
        selected ? "bg-action-surface" : "hover:bg-row-hover",
      )}
    >
      {/* 140px — the label, with the T1 chip beside it. Mono, the rubric
          register (fieldNaming.ts). */}
      <span className="flex min-w-0 items-center gap-3">
        <span className="truncate font-mono text-label leading-flat text-ink-muted">
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
