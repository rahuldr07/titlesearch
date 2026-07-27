import { useState } from "react";
import { useCorrectSeed } from "./queries";
import { useSession } from "../../shared/session";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { TextField, TextArea } from "../../shared/ui/TextField";
import { Button } from "../../shared/ui/Button";

/**
 * ACTION 2 — CORRECT THE SEED.
 *
 * REFUSED WITHOUT A SOURCE AND A REASON (`golden.spec` #3). The contract
 * requires both, so the server refuses independently; the disabled button
 * exists so the refusal is legible before it costs a round trip, and it says
 * WHY rather than greying out silently.
 *
 * THE SIGNATURE IS NOT A FIELD. It is read from the session and shown, never
 * typed — a name the client can supply is not a signature, and this log is the
 * only record of who changed what ground truth is.
 */
export function CorrectAction({ fieldId }: { fieldId: string }) {
  const [value, setValue] = useState("");
  const [cite, setCite] = useState("");
  const [reason, setReason] = useState("");
  const actor = useSession((s) => s.actor);
  const correct = useCorrectSeed();

  const ready = value.trim() !== "" && cite.trim() !== "" && reason.trim() !== "";

  return (
    <section className="flex flex-col gap-4">
      <Eyebrow variant="section">2 · Correct seed</Eyebrow>
      <p className="text-base leading-body text-ink-secondary">
        The seed is wrong. The tag upgrades to <code className="font-mono">ruled</code>,
        the change is logged with your name, and the bench reruns against the new
        value.
      </p>

      <label className="flex flex-col gap-2">
        <Eyebrow variant="field">Correct value</Eyebrow>
        <TextField
          data-testid="seed-new-value"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-2">
        <Eyebrow variant="field">Citation — where in the document</Eyebrow>
        <TextField
          data-testid="seed-cite"
          placeholder="security deed p 3, amount in words"
          value={cite}
          onChange={(event) => setCite(event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-2">
        <Eyebrow variant="field">Reason — how you read it</Eyebrow>
        <TextArea
          data-testid="seed-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>

      <div className="flex flex-wrap items-center gap-5">
        <Button
          data-testid="seed-correct-btn"
          disabled={!ready || correct.isPending}
          onClick={() =>
            correct.mutate({
              golden_field_id: fieldId,
              corrected_value: value.trim(),
              source_citation: cite.trim(),
              reason: reason.trim(),
            })
          }
        >
          {ready
            ? "Correct the seed — permanent"
            : "a correction with no source is an opinion"}
        </Button>
        <span data-testid="seed-signed-as" className="text-xs text-ink-muted">
          permanent · on the record · signed {actor}
        </span>
      </div>
    </section>
  );
}
