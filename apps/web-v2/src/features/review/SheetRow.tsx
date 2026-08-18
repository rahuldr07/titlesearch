import type { Field } from "@titlepipe/contract";
import { isExcluded, rowMark } from "../../entities/field/fieldLabel";
import { SheetRowLabel } from "./SheetRowLabel";
import { rowTone } from "./rowTone";
import { FieldValue } from "../../entities/field/FieldValue";
import { cn } from "../../shared/ui/classNames";

/**
 * ONE LINE OF THE DRAFT DELIVERABLE — the export's report row (`:967-1023`):
 * a label column carrying the field's name and its flags, a value column
 * carrying what will actually be printed, and a mark column carrying how it
 * was closed.
 *
 * THIS IS THE SURFACE THAT LISTS EVERY FIELD, so it is the one that emits
 * `row-{path}`. `auto_confirmed` and `pending` fields appear on no queue
 * anywhere, and a reviewer still has to be able to look at one — that is how a
 * bad threshold gets noticed.
 *
 * "NOT AVAILABLE" IS WHAT SHIPS; the chip beside the label says which of the
 * four answers produced it (`SheetRowLabel`). A PENDING FIELD IS NEITHER — it
 * renders "not yet extracted", because saying the value is unavailable would
 * report a conclusion nobody reached.
 *
 * THE ROW IS THE POINTER TARGET AND THE LABEL IS THE CONTROL — the click
 * handler is on both, for the mouse here and the keyboard there.
 *
 * SELECTION, NOT HOVER. There is no `:hover` rule on any table row in the
 * export — the active row is filled and that is the only row treatment. A hover
 * state would make every row the pointer crosses look momentarily selected, on
 * a screen where "which field am I deciding" is the whole question.
 *
 * FIXED LABEL MEASURE, NOT A FRACTION. `w-1/3` was a third of whatever the pane
 * happened to be, so values started at one x on a wide window and another on a
 * narrow one. `w-72` (144px) wraps the longest label this vocabulary makes
 * (`JGMT 1 — PLAINTIFF ATTORNEY`) and starts every value at the same x. The
 * mark is its own SIBLING column for the same reason — inside the value's wrap
 * it landed somewhere different on every row.
 *
 * THE ROW CARRIES ITS STATE AS A LEFT RULE AND A TINT (`rowTone`, which reads
 * server `state` and the provenance predicates and nothing else). The RULE is
 * why the tint is not load-bearing: a colour deficiency, a cheap panel or a
 * greyscale printout must still separate an open row from a closed one.
 * Selection outranks tone in the FILL — "which row am I on" is the more urgent
 * question and two fills cannot share one element — and the state survives it
 * in the rule, which selection does not touch.
 *
 * THE QUESTION IS ON THE ROW, not only in the card. `asking`/`why` are the
 * server's own words, and a sheet of twelve amber rows that makes you open each
 * one to learn why is a sheet you learn to clear without reading. Only when the
 * server sent them, only while the row is open — on a settled row it would
 * re-litigate somebody's decision — and NOT on the selected row, whose card
 * leads with the same sentence an inch below it.
 */
/** The selected row, named for the tie line. See `EVIDENCE_ANCHOR_ID`. */
export const SHEET_ANCHOR_ID = "sheet-anchor";

export function SheetRow({
  field,
  selected,
  onSelect,
}: {
  field: Field;
  selected: boolean;
  onSelect: () => void;
}) {
  const mark = rowMark(field);
  const tone = rowTone(field);
  const shipsAsNotAvailable =
    field.value === null && field.na_reason !== null && !isExcluded(field);
  // The server's question, shown only while it is still somebody's to answer —
  // and NOT on the selected row, where the decision card immediately beneath
  // leads with the same sentence. Two copies an inch apart read as two
  // questions.
  const open = field.state === "needs_review" || field.state === "escalated";
  const question = open && !selected ? (field.asking ?? field.why ?? null) : null;

  return (
    <div
      // Only the SELECTED row is named. The tie line has one end here, and a
      // per-row id would put twenty-one unused ids in the document to give it
      // one — plus the id would have to encode a path containing dots, which is
      // legal in HTML and miserable in a selector.
      id={selected ? SHEET_ANCHOR_ID : undefined}
      data-testid={`row-${field.path}`}
      onClick={onSelect}
      className={cn(
        "flex gap-6 border-t border-line-subtle border-l-2 border-l-transparent px-7 py-4 first:border-t-0",
        tone === "halt" && "border-l-state-halt bg-state-halt-surface",
        tone === "attend" && "border-l-state-attend bg-state-attend-surface",
        tone === "settled" && "border-l-state-settled",
        selected && "bg-action-surface",
      )}
    >
      <SheetRowLabel field={field} selected={selected} onSelect={onSelect} />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-4">
          {shipsAsNotAvailable ? (
            <span className="font-mono text-base text-ink-secondary">Not Available</span>
          ) : null}
          <FieldValue field={field} />
        </div>

        {question === null ? null : (
          <p
            data-testid={`row-question-${field.path}`}
            className={cn(
              "text-tiny leading-body",
              tone === "halt" ? "text-state-halt-ink" : "text-state-attend-ink",
            )}
          >
            {question}
          </p>
        )}
      </div>

      {mark === null ? null : (
        <span
          data-testid="row-mark"
          className="shrink-0 pt-1 text-xs font-semibold text-state-settled-ink"
        >
          {mark}
        </span>
      )}
    </div>
  );
}
