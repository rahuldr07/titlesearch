import type { Field } from "@titlepipe/contract";
import {
  enginesDisagree,
  fieldLabel,
  isExcluded,
  naChip,
  rowMark,
} from "../../entities/field/fieldLabel";
import { FieldValue } from "../../entities/field/FieldValue";
import { Chip } from "../../shared/ui/Chip";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { cn } from "../../shared/ui/classNames";

/**
 * ONE LINE OF THE DRAFT DELIVERABLE — the export's report row (`:967-1023`):
 * a 33% label column carrying the field's name and its flags, and a value
 * column carrying what will actually be printed.
 *
 * THIS IS THE SURFACE THAT LISTS EVERY FIELD, so it is the one that emits
 * `row-{path}`. `auto_confirmed` and `pending` fields appear on no queue
 * anywhere, and a reviewer still has to be able to look at one — that is how a
 * bad threshold gets noticed.
 *
 * "NOT AVAILABLE" IS WHAT SHIPS; THE CHIP IS WHAT SEPARATES THE FOUR REASONS.
 * The delivered Word document prints the same two words for all four NA
 * answers, so the sheet — which IS that document, in draft — prints them too,
 * and the flag beside the label says which answer produced them. Both are here
 * because the reviewer needs the report's text and the reason behind it at the
 * same time; that pairing is what makes a wrong NA reason visible before it
 * leaves the building. The reason's own render comes from `NoValue`, whose
 * border style and fill carry the distinction into greyscale.
 *
 * A PENDING FIELD IS NEITHER. It renders "not yet extracted" and never "Not
 * Available", because the pipeline has not looked yet: saying the value is
 * unavailable would report a conclusion nobody reached.
 *
 * THE ROW IS THE POINTER TARGET AND THE LABEL IS THE CONTROL. The export makes
 * the whole row clickable (`<div onClick>`), which is right for a mouse and
 * unreachable by keyboard on its own — so the handler sits on the row for the
 * pointer AND on a real `<button>` around the label for everything else. It is
 * deliberately not one whole-row `<button>`: `FieldValue` puts a `PageChip`
 * button inside the value, and a button inside a button is invalid markup that
 * screen readers announce unpredictably. "Select this field" and "show me page
 * 3" are two intents that happen to sit near each other.
 *
 * SELECTION, NOT HOVER. There is no `:hover` rule on any table row in the
 * export — the active row is filled and that is the only row treatment. A hover
 * state would make every row the pointer crosses look momentarily selected, on
 * a screen where "which field am I deciding" is the whole question.
 */
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
  const shipsAsNotAvailable =
    field.value === null && field.na_reason !== null && !isExcluded(field);

  return (
    <div
      data-testid={`row-${field.path}`}
      onClick={onSelect}
      className={cn(
        "flex gap-7 border-t border-line-subtle px-8 py-5 first:border-t-0",
        selected && "bg-action-surface",
      )}
    >
      <div className="flex w-1/3 shrink-0 flex-col items-start gap-3 pt-1">
        <button
          type="button"
          data-testid={`sheet-${field.path}`}
          onClick={onSelect}
          aria-current={selected ? "true" : undefined}
          className="text-left"
        >
          <Eyebrow variant="field" tone={selected ? "action" : "muted"}>
            {fieldLabel(field.path)}
          </Eyebrow>
        </button>

        {field.na_reason === null ? null : (
          <Chip
            tone={field.na_reason === "PRESENT_UNREADABLE" ? "halt" : "neutral"}
            size="micro"
            bordered
          >
            {naChip(field.na_reason)}
          </Chip>
        )}

        {enginesDisagree(field) ? (
          <Chip tone="attend" size="micro" bordered>
            A≠B
          </Chip>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-4">
        {shipsAsNotAvailable ? (
          <span className="font-mono text-base text-ink-secondary">Not Available</span>
        ) : null}
        <FieldValue field={field} />
        {mark === null ? null : (
          <span data-testid="row-mark" className="text-xs font-semibold text-state-settled-ink">
            {mark}
          </span>
        )}
      </div>
    </div>
  );
}
