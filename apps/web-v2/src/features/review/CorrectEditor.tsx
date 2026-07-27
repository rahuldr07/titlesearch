import { useEffect, useRef, useState } from "react";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { TextField } from "../../shared/ui/TextField";

/**
 * A CORRECTION IS REFUSED WITHOUT ITS REASON (`review.spec` #4; conflict C8).
 *
 * The design draws a "Correct to" box and a submit, with no reason field at
 * all. That is overridden. The reason is not paperwork: it is what makes the
 * correction reviewable later and what feeds the rule channel. A corrections
 * table full of value changes with no stated why cannot produce a single rule,
 * and every one of them has to be re-derived by hand from the document.
 *
 * THE REFUSAL SPEAKS (`ux.spec` #5). A silent no-op on Enter is the defect —
 * the reviewer presses the key, nothing moves, and they cannot tell whether
 * the app is broken or they are.
 */
export function CorrectEditor({
  seed,
  onSubmit,
  onCancel,
}: {
  seed: string;
  onSubmit: (value: string, reason: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(seed);
  const [reason, setReason] = useState("");
  const [refused, setRefused] = useState(false);
  const valueRef = useRef<HTMLInputElement>(null);

  // Focus follows the editor opening: `c` must land the cursor where the typing
  // goes, or a keyboard user has pressed a key and been given nothing.
  useEffect(() => valueRef.current?.focus(), []);

  const attempt = () => {
    if (value.trim() === "" || reason.trim() === "") {
      setRefused(true);
      return;
    }
    onSubmit(value.trim(), reason.trim());
  };

  const keys = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      attempt();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-5 border border-action-border bg-action-surface p-5">
      <Eyebrow variant="field">Correct to</Eyebrow>
      <TextField
        ref={valueRef}
        data-testid="edit-value"
        value={value}
        tone={refused ? "halt" : "neutral"}
        onChange={(event) => {
          setValue(event.target.value);
          if (refused) setRefused(false);
        }}
        onKeyDown={keys}
      />
      <Eyebrow variant="field">Why — what the document says</Eyebrow>
      <TextField
        data-testid="edit-reason"
        value={reason}
        tone={refused ? "halt" : "neutral"}
        onChange={(event) => {
          setReason(event.target.value);
          if (refused) setRefused(false);
        }}
        onKeyDown={keys}
      />
      {refused ? (
        <p data-testid="nudge" role="alert" className="text-xs font-semibold text-state-halt-ink">
          a correction needs both the value and its why — the why is what makes
          it a rule later
        </p>
      ) : null}
    </div>
  );
}
