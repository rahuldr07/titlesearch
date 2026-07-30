import { Button } from "../../shared/ui/Button";
import { Card, CardBody } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * The server found two things that cannot both hold — typically a client waiving
 * or replacing a line the product's meaning depends on.
 *
 * THIS IS NOT AN ERROR AND IT IS NOT SILENTLY ALLOWED. A client may override a
 * load-bearing line — that is a commercial decision and the product does not
 * get to refuse it — but the override changes what the delivered search claims
 * to have covered, so it is applied only WITH AN ACKNOWLEDGEMENT ON RECORD.
 *
 * The banner therefore has exactly two states and no third: unacknowledged,
 * where a person still owes a decision, and acknowledged, where the conflict
 * stays visible with the acceptance attached. Dismissing it is not offered.
 *
 * THE SERVER'S SENTENCE IS PRINTED VERBATIM. It is the detector's own account
 * of what contradicts what, and paraphrasing it here would make the screen and
 * the record disagree about a decision somebody is being asked to sign.
 *
 * GROUND AND HAIRLINE COME FROM ONE PROP. Spelled by hand the pair drifts — the
 * saturated base colour instead of the pale `-border`, or no edge at all — and
 * this banner sits inside a card that already has a hairline, so a wrong one
 * here reads as the card's own edge and the conflict stops looking like a block
 * of its own.
 */
export function ConflictBanner({
  conflict,
  productName,
  acknowledged,
}: {
  conflict: string;
  productName: string;
  acknowledged: boolean;
}) {
  return (
    <Card tone="halt" accent="halt" data-testid="conflict">
      <CardBody className="px-7 py-6">
        <Eyebrow variant="caption" tone="halt" as="h3">
          Conflict — {productName} and this client cannot both be satisfied
        </Eyebrow>
        <p className="mt-3 text-base leading-body text-ink-primary">{conflict}</p>
        <div className="mt-4 flex flex-wrap items-center gap-5">
          {acknowledged ? (
            <span className="text-xs font-bold text-state-settled-ink">
              ✓ Acknowledged — applied with the conflict on record
            </span>
          ) : (
            /* CONTRACT GAP: an acknowledgement is a signed server record; no endpoint exists. */
            <Button fill="outlined" tone="halt" disabled data-testid="acknowledge-conflict">
              Acknowledge conflict
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
