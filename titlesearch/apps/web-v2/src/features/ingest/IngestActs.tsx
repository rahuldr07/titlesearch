import { Button } from "../../shared/ui/Button";

/**
 * THE TWO ACTS, in the design's words.
 *
 * RULE: an upload alone never queues an order (`ingest.spec` #2). Signing for a
 * package is what makes a missing document somebody's responsibility, and it is
 * a separate, deliberate press. The export draws ONE button here; the rule wins
 * and only the copy is borrowed — `Continue to sign-off →` lands on the press
 * that actually advances the step, which is the second one.
 *
 * FAILURE PREVENTED: auto-accepting on upload saves one click and loses the
 * only moment where a named person looked at what arrived. A single button
 * carrying the forward-arrow copy while quietly doing both would be the same
 * loss with the design's blessing on top.
 *
 * NEITHER PRESS IS GATED ON A LOCAL CHECK. §4.3 leaves the definition of a
 * complete order to the door; `disabled` here reflects only a request already
 * in flight.
 */
export function IngestActs({
  uploading,
  uploaded,
  accepting,
  onUpload,
  onAccept,
}: {
  uploading: boolean;
  /** The server created the order. It is NOT queued until the second press. */
  uploaded: boolean;
  accepting: boolean;
  onUpload: () => void;
  onAccept: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <Button block size="lg" disabled={uploading} onClick={onUpload}>
        Upload the package
      </Button>

      {uploaded ? (
        <>
          <p className="text-xs leading-body text-state-attend-ink">
            Uploaded, not accepted. Nothing is queued until somebody signs for it.
          </p>
          {/* Solid `settled`: the kit reserves a solid non-action fill for an act
              that IS its own outcome — accept, amend, retire. Two solid action
              buttons at once would make the mechanical press and the advancing
              press look identical. */}
          <Button
            block
            size="lg"
            tone="settled"
            data-testid="accept-btn"
            disabled={accepting}
            onClick={onAccept}
          >
            Continue to sign-off →
          </Button>
        </>
      ) : null}
    </div>
  );
}
