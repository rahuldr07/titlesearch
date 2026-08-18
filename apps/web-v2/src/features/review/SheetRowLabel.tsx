import type { Field } from "@titlepipe/contract";
import { enginesDisagree, fieldLabel, naChip } from "../../entities/field/fieldLabel";
import { Chip } from "../../shared/ui/Chip";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * THE LEFT COLUMN OF A DRAFT ROW — the field's name, and the flags that qualify
 * whatever the value column is about to print.
 *
 * THE LABEL IS THE CONTROL, and that is why this is a real `<button>`. The
 * export makes the whole row clickable, which is right for a mouse and
 * unreachable by keyboard; `SheetRow` keeps the pointer handler on the row and
 * this keeps the keyboard one. It is deliberately not one whole-row button:
 * `FieldValue` puts a `PageChip` button inside the value, and a button inside a
 * button is invalid markup that screen readers announce unpredictably.
 *
 * THE NA CHIP IS WHAT SEPARATES THE FOUR REASONS. The delivered Word document
 * prints "Not Available" for all four, so the sheet prints it too, and the flag
 * here says WHICH answer produced it. That pairing is what makes a wrong NA
 * reason visible before it leaves the building. `PRESENT_UNREADABLE` takes the
 * halt tone because it is the only one of the four where the evidence failed
 * rather than answered.
 *
 * `A≠B` IS THE ENGINES DISAGREEING, which is a fact about the readings and not
 * a state the server assigned — `enginesDisagree` reads them, and no adapter
 * sees another's output to produce it.
 */
export function SheetRowLabel({
  field,
  selected,
  onSelect,
}: {
  field: Field;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="flex w-72 shrink-0 flex-col items-start gap-2 pt-1">
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
  );
}
