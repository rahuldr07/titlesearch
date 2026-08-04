import { useEffect, useId, useRef, useState } from "react";
import { Card } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { RefusalNudge } from "../../shared/ui/RefusalNudge";
import { TextField } from "../../shared/ui/TextField";

/**
 * AN ESCALATION IS REFUSED WITHOUT ITS QUESTION (`review.spec` #6; conflict C9).
 *
 * The design's escalate is a bare button, and its own `escalateField` fills the
 * reason with the literal string "Escalated from review" when none was typed.
 * That is worse than omitting the field: a missing input is visibly missing,
 * while a fabricated default is indistinguishable downstream from a real
 * question, and the senior resolving it has no way to tell which they are
 * reading. Overridden — the question is typed or nothing is sent.
 *
 * ONE ACT SENDS ONE QUESTION. Enter commits and there is no button to
 * disable, so repeated Enter under latency put the same question in a senior's
 * inbox three times — an inbox that exists to be short.
 *
 * THE REFUSAL IS ANNOUNCED, NOT MERELY DRAWN. The nudge was a bare
 * `role="alert"` paragraph with no id and nothing pointing the input at it, so
 * the same release blocker was spoken on the screens that remembered the link
 * and silent here. `RefusalNudge` does that wiring itself; the id on the
 * question input exists for it to bind to.
 */
export function EscalateEditor({
  pending,
  onSubmit,
  onCancel,
}: {
  /** An escalation is already in flight — Enter again is not a second act. */
  pending: boolean;
  onSubmit: (question: string) => void;
  onCancel: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [refused, setRefused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const questionId = useId();

  useEffect(() => inputRef.current?.focus(), []);

  return (
    <Card size="nested" tone="attend" className="flex flex-col gap-3 p-5">
      <Eyebrow variant="field">What do you not know?</Eyebrow>
      <TextField
        ref={inputRef}
        id={questionId}
        data-testid="escalate-input"
        value={question}
        tone={refused ? "halt" : "neutral"}
        placeholder="the question, as you would ask it out loud"
        onChange={(event) => {
          setQuestion(event.target.value);
          if (refused) setRefused(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (pending) return; // one act, one question — whatever the latency
            if (question.trim() === "") {
              setRefused(true);
              return;
            }
            onSubmit(question.trim());
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
      />
      {refused ? (
        <RefusalNudge
          controlId={questionId}
          message="an escalation needs its question — the senior answers questions, not flags"
        />
      ) : null}
    </Card>
  );
}
