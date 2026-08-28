import type { Key } from "react-aria-components";
import { TextField } from "react-aria-components";
import { Button, Input, Label, Select, Option } from "../../components/ui";
import { ABSENCES, CONFIDENCES, type DraftEntry } from "./draftEntry";

/**
 * ONE FIELD, KEYED BLIND — the three-part contract as five controls.
 *
 * Nothing on this row is prefilled and nothing is suggested. There is no
 * machine reading beside the box, no other seat's entry, no confidence figure
 * and no engine name: `POST /api/blind/{order}/entries`
 * (endpoints.ts:290-294) "physically cannot return model output or the other
 * seat's entries", and a row that helpfully offered a draft would defeat the
 * measurement the whole programme exists to take.
 *
 * ══ THE READING SELECT IS THE FOUR-STATE TAXONOMY, PLUS ONE ════════════════
 *
 * Rule 14 and enums.ts:30-42: absence is TYPED, never a blank, and the four
 * never collapse into one grey dash. So the typist chooses between "I read a
 * value" and the four ways a document can fail to give one, and the value box
 * only exists on the first branch. An empty text box is not a fifth option —
 * a null value with a null `na_reason` already means something else entirely
 * ("not yet extracted", a statement about the PIPELINE), and letting a typist
 * produce that by leaving a box alone would forge it.
 *
 * ══ MONO IS DATA, AND THREE OF THESE ARE DATA ══════════════════════════════
 *
 * Rule 3. The field path is a data key, the value is the record being made, and
 * a citation is a citation — all three carry `data`. The labels, the two
 * selects and the button are prose and are not.
 */
export function EntryRow(props: {
  readonly draft: DraftEntry;
  readonly index: number;
  readonly onChange: (next: DraftEntry) => void;
  readonly onRemove: (() => void) | null;
}) {
  const { draft } = props;
  const id = draft.key;
  const set = (patch: Partial<DraftEntry>) => {
    props.onChange({ ...draft, ...patch });
  };

  return (
    <li
      data-testid={`entry-row-${String(props.index)}`}
      className="flex flex-col gap-6 border-b border-line-subtle px-12 py-10 last:border-b-0"
    >
      <div className="flex items-baseline justify-between gap-8">
        <span className="text-label font-semibold leading-flat text-ink-faint">
          Entry {props.index + 1}
        </span>
        {props.onRemove !== null && (
          <Button
            variant="ghost"
            data-testid={`entry-remove-${String(props.index)}`}
            onPress={props.onRemove}
          >
            Remove this entry
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="flex flex-col gap-3">
          <Label htmlFor={`${id}-path`}>Field</Label>
          <TextField
            aria-label="Field"
            value={draft.path}
            onChange={(next) => {
              set({ path: next });
            }}
          >
            <Input id={`${id}-path`} data data-testid={`entry-path-${String(props.index)}`} />
          </TextField>
        </div>

        <Select
          label="Reading"
          placeholder="What the document gives…"
          selectedKey={draft.absence ?? "READ"}
          onSelectionChange={(key: Key | null) => {
            set({ absence: ABSENCES.find((a) => a.id === key)?.id ?? null });
          }}
        >
          <Option id="READ">A value I read off the page</Option>
          {ABSENCES.map((absence) => (
            <Option key={absence.id} id={absence.id}>
              {absence.gloss}
            </Option>
          ))}
        </Select>
      </div>

      {draft.absence === null && (
        <div className="flex flex-col gap-3">
          <Label htmlFor={`${id}-value`}>Value, exactly as it reads</Label>
          <TextField
            aria-label="Value, exactly as it reads"
            value={draft.value}
            onChange={(next) => {
              set({ value: next });
            }}
          >
            <Input id={`${id}-value`} data data-testid={`entry-value-${String(props.index)}`} />
          </TextField>
        </div>
      )}

      <div className="grid grid-cols-2 gap-8">
        <div className="flex flex-col gap-3">
          <Label htmlFor={`${id}-citation`}>Source — the page it came off</Label>
          <TextField
            aria-label="Source — the page it came off"
            value={draft.citation}
            onChange={(next) => {
              set({ citation: next });
            }}
          >
            <Input
              id={`${id}-citation`}
              data
              data-testid={`entry-citation-${String(props.index)}`}
            />
          </TextField>
        </div>

        <Select
          label="How sure"
          placeholder="Say how sure you are…"
          selectedKey={draft.confidence}
          onSelectionChange={(key: Key | null) => {
            set({ confidence: CONFIDENCES.find((c) => c.id === key)?.id ?? null });
          }}
        >
          {CONFIDENCES.map((confidence) => (
            <Option key={confidence.id} id={confidence.id}>
              {confidence.gloss}
            </Option>
          ))}
        </Select>
      </div>
    </li>
  );
}
