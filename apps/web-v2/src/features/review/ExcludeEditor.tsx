import { useEffect, useId, useRef, useState } from "react";
import { Card } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { RefusalNudge } from "../../shared/ui/RefusalNudge";
import { TextField } from "../../shared/ui/TextField";

/**
 * SUPPRESSING A ROW IS REFUSED WITHOUT ITS REASON.
 *
 * Same rule as a correction, and it matters more here. A corrected value is
 * still on the sheet where somebody can disagree with it; an excluded row is
 * GONE, and a suppression with no reason on the record is indistinguishable
 * afterwards from a row nobody ever looked at. The reason is the only evidence
 * that a person decided rather than the pipeline missed.
 *
 * THE REFUSAL IS ANNOUNCED, NOT MERELY DRAWN. The nudge was a bare
 * `role="alert"` paragraph with no id and no `aria-describedby` from the reason
 * input, so the blocker reached the eye and not the screen reader — the failure
 * that leaves nothing on the record here as well as nothing on the screen.
 * `RefusalNudge` owns the link; the id on the input is what it binds to.
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
  const reasonId = useId();

  useEffect(() => inputRef.current?.focus(), []);

  return (
    <Card size="nested" tone="halt" className="flex flex-col gap-3 p-5">
      <Eyebrow variant="field">Why is this not our party?</Eyebrow>
      <TextField
        ref={inputRef}
        id={reasonId}
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
        <RefusalNudge
          controlId={reasonId}
          message="a suppression needs its reason — the row disappears, the reason is all that is left"
        />
      ) : null}
    </Card>
  );
}
