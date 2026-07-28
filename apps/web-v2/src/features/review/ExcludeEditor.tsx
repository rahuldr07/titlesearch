import { useEffect, useRef, useState } from "react";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { TextField } from "../../shared/ui/TextField";

/**
 * SUPPRESSING A ROW IS REFUSED WITHOUT ITS REASON.
 *
 * Same rule as a correction, and it matters more here. A corrected value is
 * still on the sheet where somebody can disagree with it; an excluded row is
 * GONE, and a suppression with no reason on the record is indistinguishable
 * afterwards from a row nobody ever looked at. The reason is the only evidence
 * that a person decided rather than the pipeline missed.
 */
export function ExcludeEditor({
  onSubmit,
  onCancel,
}: {
  onSubmit: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [refused, setRefused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  return (
    <div className="flex flex-col gap-3 rounded-5 border border-state-halt-border bg-state-halt-surface p-5">
      <Eyebrow variant="field">Why is this not our party?</Eyebrow>
      <TextField
        ref={inputRef}
        data-testid="exclude-reason"
        value={reason}
        tone={refused ? "halt" : "neutral"}
        placeholder="middle initial differs and the address is a different county"
        onChange={(event) => {
          setReason(event.target.value);
          if (refused) setRefused(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (reason.trim() === "") {
              setRefused(true);
              return;
            }
            onSubmit(reason.trim());
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
      />
      {refused ? (
        <p data-testid="nudge" role="alert" className="text-xs font-semibold text-state-halt-ink">
          a suppression needs its reason — the row disappears, the reason is all
          that is left
        </p>
      ) : null}
    </div>
  );
}
