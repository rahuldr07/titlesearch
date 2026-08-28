import { useState } from "react";
import type { GoldenField } from "@titlepipe/contract";
import { Alert, Button } from "../../components/ui";
import { useSession } from "../../shared/session";
import { notify } from "../../shared/notify";
import { CorrectionFields } from "./CorrectionFields";
import { SignedBy } from "./SignedBy";
import { correctionHold, useSeedCorrection } from "./useSeedCorrection";

/**
 * THE CORRECTION, AND IT IS REFUSED WITHOUT SOURCE + REASON + SIGNATURE.
 *
 * `endpoints.ts:261-268` declares `source_citation` and `reason` both
 * `.min(1)`, and `:285` says why in one line: "source + reason, permanently
 * logged and signed." The signature is the third part and is the one the form
 * cannot supply — the server derives it from the session, because "a browser
 * must not decide who signed a change to ground truth (that would be
 * forgeable)". What the form owes the reader is showing them who they are about
 * to sign as, and refusing to file when there is nobody.
 *
 * ══ THE HOLD IS SAID TWICE, IN TWO CHANNELS ════════════════════════════════
 *
 * Rule 9 asks a disabled control to state its reason; `disabled.ts` puts it on
 * `title` and `data-disabled-reason` automatically. That is a hover and an
 * attribute, and neither reaches a reader on a touch screen or one who never
 * points at the button. So the same sentence prints INLINE under it. A refusal
 * nobody can read is `INVARIANTS:12`'s silent no-op wearing a tooltip.
 *
 * ══ ONE ACT FILES ONE RECORD ═══════════════════════════════════════════════
 *
 * `INVARIANTS:20`. `correctionHold` returns a sentence while `isPending`, so
 * the button is disabled from the first click until the server answers —
 * including three clicks inside one tick, because the hold is recomputed on
 * every render from the mutation's own state rather than from a ref this
 * component would have to remember to reset.
 *
 * ══ THE REFUSAL IS DURABLE, NOT A TOAST ════════════════════════════════════
 *
 * `INVARIANTS:14` and `:16`. The server's sentence renders in place and stays.
 * `useSeedCorrection` also toasts it, but a toast is dismissible and a refusal
 * the reader dismissed is a refusal they cannot re-read while retyping. Nothing
 * on this path prefixes, edits or wraps the words.
 */
export function CorrectionForm(props: {
  readonly seed: GoldenField;
  readonly onFiled: () => void;
}) {
  const [corrected, setCorrected] = useState("");
  const [clearing, setClearing] = useState(false);
  const [citation, setCitation] = useState("");
  const [reason, setReason] = useState("");
  const signature = useSession((state) => state.actor);
  const filing = useSeedCorrection();

  const held = correctionHold({
    seed: props.seed,
    corrected,
    clearing,
    citation,
    reason,
    signature,
    sending: filing.isPending,
  });

  return (
    <div data-testid="correction-form" className="flex flex-col gap-10">
      <CorrectionFields
        clearing={clearing}
        reason={reason}
        onCorrected={setCorrected}
        onClearing={setClearing}
        onCitation={setCitation}
        onReason={setReason}
      />

      <SignedBy signature={signature} />

      {filing.isError && filing.error !== null && (
        <div data-testid="correction-refusal">
          <Alert tone="halt" title="Refused" message={filing.error.message} />
        </div>
      )}

      <div className="flex flex-col gap-4 border-l-3 border-action pl-8">
        <Button
          data-testid="correction-file"
          variant="primary"
          disabledBecause={held}
          onPress={() =>
            filing.mutate(
              {
                golden_field_id: props.seed.id,
                corrected_value: clearing ? null : corrected,
                source_citation: citation,
                reason,
              },
              {
                onSuccess: () => {
                  notify.success("Correction filed — signed and permanent.");
                  setReason("");
                  props.onFiled();
                },
              },
            )
          }
        >
          {held === null
            ? "File the correction"
            : "Held — the ruler is not edited without all three"}
        </Button>
        {held !== null && (
          <p
            data-testid="correction-hold"
            className="font-sans text-meta leading-body text-state-attend"
          >
            {held}
          </p>
        )}
      </div>
    </div>
  );
}
