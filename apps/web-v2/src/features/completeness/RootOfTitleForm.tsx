import { useId, useState } from "react";
import { Button } from "../../shared/ui/Button";
import { TextArea } from "../../shared/ui/TextField";
import { ROOT_PLACEHOLDER } from "./gapFixtures";

/**
 * "Root of title reached" is an ASSERTION, not a dismissal.
 *
 * Every other way of closing this gap produces evidence — a document, an
 * amended answer, a changed product. This one produces only a person's word
 * that nothing older exists, which is why the comment is not optional and why
 * the control refuses to record without it. A root-of-title with no stated
 * reason is indistinguishable, six months later, from someone clearing a
 * blocker to get the run moving.
 *
 * CONTRACT GAP: nothing accepts this. There is no root-of-title assertion in
 * `packages/contract`; in the product it would be an append-only record
 * carrying the comment, the person and the moment.
 */
export function RootOfTitleForm({
  onRecord,
  onCancel,
}: {
  onRecord: (comment: string) => void;
  onCancel: () => void;
}) {
  const [comment, setComment] = useState("");
  const fieldId = useId();
  const ready = comment.trim() !== "";

  return (
    <div className="mt-6 rounded-7 border border-state-settled-border bg-state-settled-surface px-7 py-6">
      <label
        htmlFor={fieldId}
        className="mb-3 block text-xs font-semibold text-state-settled-ink"
      >
        Root of title — required comment
      </label>
      <TextArea
        id={fieldId}
        rows={2}
        size="sm"
        tone="settled"
        value={comment}
        placeholder={ROOT_PLACEHOLDER}
        onChange={(event) => setComment(event.target.value)}
      />
      <div className="mt-5 flex gap-4">
        <Button size="sm" tone="settled" disabled={!ready} onClick={() => onRecord(comment.trim())}>
          Record root of title
        </Button>
        <Button size="sm" tone="neutral" fill="outlined" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
