import { Eyebrow } from "./Eyebrow";
import { Card, CardBody } from "./Card";

/**
 * "You said …" over "We found …" — the shape for anywhere the machine
 * contradicts a human.
 *
 * `component-inventory.md` §2.9 says to GENERALISE this rather than tie it to
 * the completeness gate, and that is right: the same shape serves the
 * disclosure card (the abstractor said NO), complaint capture (*"the HUD shows
 * 215,500 — your report says 215,000"*, `delivery-complaints.spec` #4), and a
 * reconciliation third value. The labels are props for that reason.
 *
 * THE PROVISIONAL BAND IS THE IMPORTANT PART. It marks a check whose
 * precondition is a fixture rather than a real signal, and says so on screen.
 * That is principle 6 applied to a CHECK rather than a value: a check with
 * nothing behind it refuses to present itself as evidence.
 *
 * The design does this to its own completeness gate, in a comment headed
 * PROVENANCE AUDIT, and then renders the caveat to the user. Keep that
 * instinct — it is the single most trustworthy thing in the export.
 */
export function ClaimVsEvidence({
  claimLabel = "You said",
  claim,
  evidenceLabel = "We found",
  evidence,
  provisionalReason,
}: {
  claimLabel?: string;
  /** What the human asserted. */
  claim: string;
  evidenceLabel?: string;
  /** What the machine actually found. */
  evidence: string;
  /**
   * Present when the check has no real evidence behind it. Renders the caveat
   * rather than letting an unbacked check pass as proof.
   */
  provisionalReason?: string | undefined;
}) {
  return (
    <Card accent={provisionalReason ? "attend" : "none"}>
      <CardBody>
        <Row label={claimLabel} tone="muted" value={claim} />
        <div className="mt-4">
          <Row label={evidenceLabel} tone="halt" value={evidence} />
        </div>

        {provisionalReason ? (
          <div className="mt-6 border-t border-line-subtle pt-5">
            <Eyebrow variant="caption" tone="attend">
              Provisional — not yet evidence about this order
            </Eyebrow>
            <p className="mt-2 text-xs text-ink-secondary">{provisionalReason}</p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function Row({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "muted" | "halt";
  value: string;
}) {
  return (
    <div className="flex gap-5">
      <Eyebrow variant="field" tone={tone} className="w-42 shrink-0 pt-1">
        {label}
      </Eyebrow>
      <p className="flex-1 text-base leading-body text-ink-primary">{value}</p>
    </div>
  );
}
