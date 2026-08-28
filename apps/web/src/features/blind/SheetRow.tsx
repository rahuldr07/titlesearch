import type { Key } from "react";
import type { SheetField } from "@titlepipe/contract";
import { TextField } from "react-aria-components";
import { Input, Label, Option, Select } from "../../components/ui";
import { NoValueChip } from "../../entities/field/NoValueChip";
import { ABSENCES, isAnswered, type DraftEntry } from "./draftEntry";
import { RowProvenance } from "./RowProvenance";

const KEYED = "KEYED";

/** The control the schedule asks for. `kind` drives the box, never a validator. */
function Reading(props: {
  readonly field: SheetField;
  readonly draft: DraftEntry;
  readonly index: number;
  readonly onValue: (next: string) => void;
}) {
  const testid = `entry-value-${String(props.index)}`;

  if (props.field.kind === "select") {
    return (
      <Select
        label={props.field.label}
        placeholder="Choose what the instrument says…"
        selectedKey={props.draft.value === "" ? null : props.draft.value}
        onSelectionChange={(key: Key | null) => {
          props.onValue(key === null ? "" : String(key));
        }}
      >
        {props.field.options.map((option) => (
          <Option key={option} id={option}>
            {option}
          </Option>
        ))}
      </Select>
    );
  }

  return (
    <TextField aria-label={props.field.label} value={props.draft.value} onChange={props.onValue}>
      <Input
        data={props.field.kind !== "text"}
        type={props.field.kind === "date" ? "date" : "text"}
        inputMode={props.field.kind === "money" ? "decimal" : undefined}
        data-testid={testid}
      />
    </TextField>
  );
}

export function SheetRow(props: {
  readonly field: SheetField;
  readonly draft: DraftEntry;
  readonly index: number;
  readonly onChange: (next: DraftEntry) => void;
}) {
  const { draft, field } = props;
  const set = (patch: Partial<DraftEntry>) => {
    props.onChange({ ...draft, ...patch });
  };

  return (
    <li
      data-testid={`entry-row-${String(props.index)}`}
      data-path={field.path}
      className="flex flex-col gap-5 border-b border-line-subtle px-11 py-8 last:border-b-0"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">
        <div className="flex w-64 shrink-0 flex-col gap-2 pt-4">
          <Label>{field.label}</Label>
          <span className="font-sans text-label leading-flat text-ink-faint">
            {field.required ? "Required" : "Optional"}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {draft.absence === null ? (
            <Reading
              field={field}
              draft={draft}
              index={props.index}
              onValue={(value) => {
                set({ value });
              }}
            />
          ) : (
            /*
             * The shared chip, not a coloured line of text. `noValueStates`
             * carries the reason the four differ in EVERY channel at once —
             * mark, ink, border style and fill — because colour alone does not
             * survive greyscale or a red-green deficiency. The picker below
             * keeps the typist's own phrasing; the echo speaks the taxonomy's.
             */
            <NoValueChip render={draft.absence} />
          )}

          <Select
            label={`What ${field.label} gives`}
            placeholder="A value I read off the page"
            selectedKey={draft.absence ?? KEYED}
            onSelectionChange={(key: Key | null) => {
              set({ absence: ABSENCES.find((a) => a.id === key)?.id ?? null });
            }}
          >
            <Option id={KEYED}>A value I read off the page</Option>
            {ABSENCES.map((absence) => (
              <Option key={absence.id} id={absence.id}>
                {absence.gloss}
              </Option>
            ))}
          </Select>
        </div>
      </div>

      {isAnswered(draft) && (
        <div className="flex flex-col gap-5 sm:flex-row sm:gap-8">
          <span aria-hidden className="hidden w-64 shrink-0 sm:block" />
          <RowProvenance draft={draft} index={props.index} onChange={set} />
        </div>
      )}
    </li>
  );
}
