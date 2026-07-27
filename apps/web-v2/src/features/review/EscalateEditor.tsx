import { useEffect, useRef, useState } from "react";
import { Eyebrow } from "../../shared/ui/Eyebrow";
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
 */
export function EscalateEditor({
  onSubmit,
  onCancel,
}: {
  onSubmit: (question: string) => void;
  onCancel: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [refused, setRefused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  return (
    <div className="flex flex-col gap-3 rounded-5 border border-state-attend-border bg-state-attend-surface p-5">
      <Eyebrow variant="field">What do you not know?</Eyebrow>
      <TextField
        ref={inputRef}
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
        <p data-testid="nudge" role="alert" className="text-xs font-semibold text-state-halt-ink">
          an escalation needs its question — the senior answers questions, not
          flags
        </p>
      ) : null}
    </div>
  );
}
