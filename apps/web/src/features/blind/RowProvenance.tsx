import { type Key, TextField } from "react-aria-components";
import { Input, Label, Option, Select } from "../../components/ui";
import { CONFIDENCES, type DraftEntry } from "./draftEntry";

/**
 * The two things a keyed row owes beside the reading: the page it came off, and
 * how sure the typist is. Both are schema-required, so neither has a default.
 */
export function RowProvenance(props: {
  readonly draft: DraftEntry;
  readonly index: number;
  readonly onChange: (patch: Partial<DraftEntry>) => void;
}) {
  return (
    <div className="grid min-w-0 flex-1 grid-cols-1 gap-5 sm:grid-cols-2">
      <div className="flex flex-col gap-3">
        <Label>Source — the page it came off</Label>
        <TextField
          aria-label="Source — the page it came off"
          value={props.draft.citation}
          onChange={(citation) => {
            props.onChange({ citation });
          }}
        >
          <Input data data-testid={`entry-citation-${String(props.index)}`} />
        </TextField>
      </div>
      <Select
        label="How sure"
        placeholder="Say how sure you are…"
        selectedKey={props.draft.confidence}
        onSelectionChange={(key: Key | null) => {
          props.onChange({ confidence: CONFIDENCES.find((c) => c.id === key)?.id ?? null });
        }}
      >
        {CONFIDENCES.map((confidence) => (
          <Option key={confidence.id} id={confidence.id}>
            {confidence.gloss}
          </Option>
        ))}
      </Select>
    </div>
  );
}
