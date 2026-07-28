import { Button } from "../../shared/ui/Button";
import { Card, CardBody } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

import type { Conflict } from "./effective";

/**
 * A client has waived a line the product's meaning depends on.
 *
 * THIS IS NOT AN ERROR AND IT IS NOT SILENTLY ALLOWED. A client may waive a
 * load-bearing line — that is a commercial decision and the product does not
 * get to refuse it — but the waive changes what the delivered search claims to
 * have covered, so it is applied only WITH AN ACKNOWLEDGEMENT ON RECORD.
 *
 * The banner therefore has exactly two states and no third: unacknowledged,
 * where a person still owes a decision, and acknowledged, where the conflict
 * stays visible with the acceptance attached. Dismissing it is not offered.
 * Quoting the client's own reason back verbatim is deliberate — the person
 * acknowledging should be reading what the client actually asked for, not a
 * summary of it.
 */
export function ConflictBanner({
  conflict,
  productName,
  acknowledged,
}: {
  conflict: Conflict;
  productName: string;
  acknowledged: boolean;
}) {
  return (
    <Card
      accent="halt"
      data-testid={`conflict-${conflict.key}`}
      className="border-state-halt-border bg-state-halt-surface"
    >
      <CardBody className="px-7 py-6">
        <Eyebrow variant="caption" tone="halt" as="h3">
          Conflict — a waive the product&rsquo;s meaning depends on
        </Eyebrow>
        <p className="mt-3 text-base leading-body text-ink-primary">
          <span className="font-semibold">
            Line {conflict.n} · {conflict.label}.
          </span>{" "}
          {productName} requires this line, but this client waives it: “
          {conflict.override}”.
        </p>
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
