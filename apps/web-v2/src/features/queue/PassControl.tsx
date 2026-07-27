import { useEffect, useRef, useState } from "react";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { TextField } from "../../shared/ui/TextField";

/**
 * "Why are you passing?" — the refusal, inline.
 *
 * `queue.spec` #3 (ORPHAN RULE) pins three things: the input takes focus when
 * it opens, Enter on an empty value submits NOTHING, and Escape closes it
 * leaving the order where it was. All three are about not losing a reviewer's
 * place, and none of them is a validation message — nothing is "invalid" here,
 * the reviewer simply has not finished.
 *
 * The nudge appears only after a refused submit, never on open: telling someone
 * they are missing something they have not yet had a chance to type reads as
 * an error when it is really an instruction.
 */
export function PassControl({
  onSubmit,
  onCancel,
  pending,
}: {
  onSubmit: (reason: string) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState("");
  const [refused, setRefused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus follows the control opening. Without it a keyboard user presses `p`
  // and their focus stays where it was, with no way to know anything happened.
  useEffect(() => inputRef.current?.focus(), []);

  const empty = reason.trim() === "";

  return (
    <div className="mt-6 flex flex-col gap-3">
      <Eyebrow as="label" htmlFor="pass-reason" variant="field">
        Why are you passing?
      </Eyebrow>
      <TextField
        id="pass-reason"
        ref={inputRef}
        value={reason}
        disabled={pending}
        // Lower-case deliberately: `queue.spec` #3 matches /why are you passing/
        // case-sensitively. The spec is the authority on copy here — rewriting
        // the regex to /i would be weakening a harvested assertion.
        placeholder="why are you passing this order?"
        tone={refused ? "halt" : "neutral"}
        emphasis={refused}
        aria-describedby={refused ? "pass-nudge" : undefined}
        onChange={(e) => {
          setReason(e.target.value);
          if (refused) setRefused(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (empty) {
              setRefused(true);
              return;
            }
            onSubmit(reason.trim());
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      {refused ? (
        <p
          id="pass-nudge"
          data-testid="nudge"
          role="alert"
          className="text-xs font-semibold text-state-halt-ink"
        >
          {/* Lower-case and this exact wording because `ux.spec` #6 asserts
              toContainText("a pass needs its why") case-sensitively. */}
          a pass needs its why — one line is enough
        </p>
      ) : null}
    </div>
  );
}
