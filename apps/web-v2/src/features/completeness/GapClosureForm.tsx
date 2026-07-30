import { useId, useState } from "react";
import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { TextArea } from "../../shared/ui/TextField";

/**
 * Closing a gap is an ASSERTION, not a dismissal.
 *
 * Whichever way out was chosen, the record it leaves is a person saying this
 * package now supports the claim — and the control refuses to record without
 * the sentence that says why. A closure with no stated reason is
 * indistinguishable, six months later, from someone clearing a blocker to get
 * the run moving.
 *
 * CONTRACT GAP: nothing accepts this. There is no closure write in
 * `packages/contract`; in the product it would be an append-only record
 * carrying the option, the comment, the person and the moment. The button below
 * records into this screen's own state and no further.
 *
 * The form wears the SETTLED ground the closed note wears, at the same nested
 * radius, because it is the same block in its unfilled state. Drawn as a plain
 * panel it would read as a form that appeared next to the gap rather than as
 * the record about to be written onto it.
 */
export function GapClosureForm({
  option,
  onRecord,
  onCancel,
}: {
  option: string;
  onRecord: (note: string) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState("");
  const fieldId = useId();
  const ready = note.trim() !== "";

  return (
    <Card size="nested" tone="settled" className="mt-6 px-7 py-6">
      <label htmlFor={fieldId} className="mb-3 block text-xs font-semibold text-state-settled-ink">
        {option} — required reason
      </label>
      <TextArea
        id={fieldId}
        rows={2}
        size="sm"
        tone="settled"
        value={note}
        placeholder="Why does this close the gap? The order's history carries this sentence."
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="mt-5 flex gap-4">
        <Button size="sm" tone="settled" disabled={!ready} onClick={() => onRecord(note.trim())}>
          Record closure
        </Button>
        <Button size="sm" tone="neutral" fill="outlined" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
