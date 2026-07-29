import { useEffect, useRef, useState } from "react";
import { Button } from "../../shared/ui/Button";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { TextField } from "../../shared/ui/TextField";

/**
 * A CORRECTION MUST ACTUALLY CHANGE SOMETHING (§11.1). Empty, or identical to
 * the machine read, is refused: the submit is INERT (disabled) until the value
 * differs, and a bare Enter on an unchanged value records nothing. A no-op
 * correction filed against the corrections table produces no rule and forces
 * every value change to be re-derived by hand. The disabled control is the
 * courtesy; the contract's `min(1)`/diff is the enforcement.
 *
 * A CORRECTION IS REFUSED WITHOUT ITS REASON (`review.spec` #4; conflict C8).
 * The design draws a "Correct to" box and a submit, with no reason field at
 * all. That is overridden. The reason is not paperwork: it is what makes the
 * correction reviewable later and what feeds the rule channel. Once the value
 * has changed the submit is ENABLED even with the reason empty — the reason is
 * a gate that SPEAKS on submit (`ux.spec` #5), never a silent no-op.
 *
 * ENTER COMMITS FROM INSIDE THE FIELD, ESCAPE LEAVES IT — handled on the editor
 * container, above react-hotkeys-hook's input guard, so neither text input
 * carries its own key handler. The container sees the event whichever field has
 * focus, and a bracket or a chord key still reaches the input as text
 * (`sidebar.spec` #5, `hard.spec` #5).
 */
export function CorrectEditor({
  seed,
  machineValue,
  onSubmit,
  onCancel,
}: {
  seed: string;
  machineValue: string;
  onSubmit: (value: string, reason: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(seed);
  const [reason, setReason] = useState("");
  const [refused, setRefused] = useState(false);
  const valueRef = useRef<HTMLInputElement>(null);

  // `e` lands the caret in the value and SELECTS it, so typing replaces the
  // machine read rather than appending to it (the design's `el.select()`).
  useEffect(() => {
    valueRef.current?.focus();
    valueRef.current?.select();
  }, []);

  const changed = value.trim() !== "" && value.trim() !== machineValue.trim();

  const attempt = () => {
    if (!changed) return; // inert: a correction must differ from the machine read
    if (reason.trim() === "") {
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
    <div
      onKeyDown={keys}
      className="flex flex-col gap-3 rounded-5 border border-action-border bg-action-surface p-5"
    >
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
      />
      <Button
        size="sm"
        data-testid="edit-submit"
        tone="action"
        disabled={!changed}
        onClick={attempt}
      >
        ✎ Save correction
      </Button>
      {refused ? (
        <p data-testid="nudge" role="alert" className="text-xs font-semibold text-state-halt-ink">
          a correction needs both the value and its why — the why is what makes
          it a rule later
        </p>
      ) : null}
    </div>
  );
}
