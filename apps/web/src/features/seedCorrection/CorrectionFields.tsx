import { Checkbox, Input, Label, Textarea } from "../../components/ui";

/**
 * THE THREE PARTS A CORRECTION IS REFUSED WITHOUT — the value, the source, and
 * the reason — as controls.
 *
 * Split from `CorrectionForm` on the §6 length gate, and the seam is real: this
 * file is the FORM SURFACE and holds no state, no mutation and no decision.
 * `CorrectionForm` owns the state and `correctionHold` owns the refusal.
 *
 * ══ WHY THE VALUE HAS TWO ARMS ═════════════════════════════════════════════
 *
 * `corrected_value` is `z.string().nullable()` (endpoints.ts:264). Null is a
 * real correction — "the corpus should hold nothing here" — and a text box
 * alone cannot express it, because an empty string is a value and filing `""`
 * as ground truth is a different claim from filing nothing. So the null arm is
 * a checkbox, and the box goes read-only WITH ITS REASON (rule 9) rather than
 * being silently ignored while the reader keeps typing into it.
 *
 * ══ THE VALUE AND SOURCE BOXES ARE UNCONTROLLED, AND THAT IS FORCED ════════
 *
 * `InputProps` omits `value` and `defaultValue` (`input.tsx:43`): the value
 * belongs to react-aria's `TextField`, which this kit does not export.
 * `onChange` passes through, nothing but the reader ever writes these, and
 * `CorrectionForm` is remounted by `key` when the chosen field changes — which
 * is what clears them, rather than a reset the DOM would ignore.
 *
 * The reason is a `Textarea`, which DOES take `value`, and it is controlled so
 * that filing can clear it.
 */
export function CorrectionFields(props: {
  readonly clearing: boolean;
  readonly reason: string;
  readonly onCorrected: (next: string) => void;
  readonly onClearing: (next: boolean) => void;
  readonly onCitation: (next: string) => void;
  readonly onReason: (next: string) => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-4">
        <Label htmlFor="corrected-value">The value the corpus should hold</Label>
        {/* Rule 3: a seed value is data — money, a docket type, a name as
            recorded — so the box that holds one is mono. */}
        <Input
          id="corrected-value"
          data-testid="corrected-value"
          data
          disabledBecause={
            props.clearing
              ? "Clearing the value — untick below to type one instead."
              : null
          }
          onChange={(event) => props.onCorrected(event.target.value)}
        />
        <Checkbox
          isSelected={props.clearing}
          onChange={props.onClearing}
          data-testid="corrected-null"
        >
          The corpus should hold no value here
        </Checkbox>
      </div>

      <div className="flex flex-col gap-4">
        <Label htmlFor="correction-source">
          The source, cited so a later reader can find it
        </Label>
        <Input
          id="correction-source"
          data-testid="correction-source"
          data
          placeholder="Instrument, page and the words relied on"
          onChange={(event) => props.onCitation(event.target.value)}
        />
        <span className="font-sans text-label leading-body text-ink-muted">
          Required. A correction to the ruler that cites no document is an
          opinion, and the server refuses it (endpoints.ts:285).
        </span>
      </div>

      <div className="flex flex-col gap-4">
        <Label htmlFor="correction-reason">
          Why the seed is wrong, in the words that go on the record
        </Label>
        <Textarea
          id="correction-reason"
          data-testid="correction-reason"
          aria-label="Why the seed is wrong, in the words that go on the record"
          value={props.reason}
          onChange={(event) => props.onReason(event.target.value)}
        />
        <span className="font-sans text-label leading-body text-ink-muted">
          Required, and permanently logged beside the change. It is what a later
          reader has to judge this correction by.
        </span>
      </div>
    </>
  );
}
