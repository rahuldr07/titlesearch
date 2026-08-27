import type { Field } from "@titlepipe/contract";
import { readCited } from "../../shared/provenance";
import { cx } from "../../components/ui";
import { FieldValueView } from "../../entities/field/FieldValueView";
import { fieldLabel } from "./fieldNaming";
import { readingsDisagree } from "./readings";
import { RowMark } from "./RowMark";
import { T1Pill } from "./T1Pill";

/**
 * ONE FIELD ROW — the design's `140px / 1fr / 70px / 24px` grid (§Screens 7).
 *
 * Label 11px, value mono, cite mono grey, mark. Four tracks and no fifth,
 * because rule 6 allows ONE status signal per row and the mark is it: the
 * A≠B chip and the T1 pill both ride in the value track, under the value,
 * where they are describing the READING rather than competing with the row's
 * own state.
 *
 * ══ NOTHING ON THIS ROW IS DERIVED ═════════════════════════════════════════
 *
 * The value goes through `readCited` (the only supported way to print one —
 * `provenance.ts`, and `check-rules.mjs` enforces it), which classifies what
 * the SERVER sent into the six renders. The mark reads `state`. The A≠B chip
 * reads whether the server sent two readings that differ, which is a fact
 * about the payload rather than a judgement about the field.
 */
export type FieldRowProps = {
  readonly field: Field;
  readonly selected: boolean;
  readonly onSelect: () => void;
  /**
   * Whether this field carries ruinous exposure. SERVER-SUPPLIED via
   * `rule_refs` — see `T1Pill`, which refuses to decide it.
   */
  readonly ruinous: boolean;
};

export function FieldRow({ field, selected, onSelect, ruinous }: FieldRowProps) {
  const value = readCited(field);
  /*
   * A≠B: the readings the server sent carry different values. A fact about the
   * payload, not a ruling — INVARIANT 28 requires the disagreement to be
   * surfaced ON THE ROW, and this is that surface. Decided in `readings.ts`,
   * which is where touching a reading's `.value` belongs.
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
      {/* 140px — the label. 11px, mono, the rubric register (fieldNaming.ts). */}
      <span className="truncate font-mono text-label leading-flat tracking-caps text-ink-muted">
        {fieldLabel(field.path)}
      </span>

      {/* 1fr — the value, with the reading signals under it. */}
      <span className="flex min-w-0 flex-col gap-2">
        <FieldValueView value={value} />
        <span className="flex flex-wrap items-center gap-3">
          {disagree && (
            <span
              data-testid="row-disagreement"
              className="rounded-sm border border-state-attend-border bg-state-attend-surface px-3 font-mono text-label leading-flat text-state-attend"
            >
              A≠B
            </span>
          )}
          {ruinous && <T1Pill />}
        </span>
      </span>

      {/* 70px — the citation, mono grey. Absent is not a dash: a field with no
          citation has already rendered as `uncited` above, loudly. */}
      <span className="truncate text-right font-mono text-label leading-flat text-ink-faint tabular-nums">
        {field.source_page === null ? "" : `p.${field.source_page}`}
      </span>

      {/* 24px — the mark. Rule 6: ONE status signal per row. */}
      <RowMark field={field} />
    </button>
  );
}
