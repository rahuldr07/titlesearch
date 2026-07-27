import { useId, useState } from "react";
import { TextArea } from "./TextField";
import { Button } from "./Button";
import { Eyebrow } from "./Eyebrow";

/**
 * The refusal control. One component carries most of the §0.5 refusal rules:
 * a correction needs its reason, an escalation needs its question, a pass needs
 * its why, a ruling needs its citation, a sign-off NO needs its comment.
 *
 * Two rules it exists to enforce, both harvested INVARIANTS:
 *
 *  - **Nothing submits empty.** `review.spec` #4 and #6, `queue.spec` #3,
 *    `golden.spec` #3, `escalations.spec` #1.
 *  - **A refusal must SAY WHY** (orphan O10, `ux.spec` #5/#6). A disabled
 *    button that gives no reason is the defect those specs pin shut, so the
 *    nudge is not decoration — it is the requirement.
 *
 * The submit stays enabled and the refusal is explained on click, rather than
 * the button being inert. An inert control tells a keyboard or screen-reader
 * user nothing about what is missing; a control that answers does.
 *
 * THIS IS UI FEEDBACK, NOT AUTHORITY (§9.14). The server refuses the same
 * submissions independently. Every rule here has a server counterpart, and a
 * test posting the invalid states straight to the API asserts the 422 — that is
 * what proves this layer is a mirror rather than a load-bearing wall.
 */
export function RequiredComment({
  label,
  submitLabel,
  missingMessage,
  placeholder,
  onSubmit,
  rows = 3,
}: {
  label: string;
  submitLabel: string;
  /** Names exactly what is missing. Never "invalid" or "required". */
  missingMessage: string;
  placeholder?: string | undefined;
  onSubmit: (comment: string) => void;
  rows?: number;
}) {
  const [comment, setComment] = useState("");
  const [nudged, setNudged] = useState(false);
  const fieldId = useId();
  const nudgeId = useId();

  const empty = comment.trim() === "";

  return (
    <div className="flex flex-col gap-3">
      <Eyebrow as="label" htmlFor={fieldId} variant="field">
        {label}
      </Eyebrow>
      <TextArea
        id={fieldId}
        rows={rows}
        value={comment}
        placeholder={placeholder}
        tone={nudged && empty ? "halt" : "neutral"}
        emphasis={nudged && empty}
        aria-describedby={nudged && empty ? nudgeId : undefined}
        onChange={(e) => {
          setComment(e.target.value);
          if (nudged) setNudged(false);
        }}
      />
      {nudged && empty ? (
        <p
          id={nudgeId}
          role="alert"
          className="text-xs font-semibold text-state-halt-ink"
        >
          {missingMessage}
        </p>
      ) : null}
      <div>
        <Button
          onClick={() => {
            if (empty) {
              setNudged(true);
              return;
            }
            onSubmit(comment.trim());
          }}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
