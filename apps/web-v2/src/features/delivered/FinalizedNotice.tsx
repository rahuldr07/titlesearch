import { ArtifactCard } from "./ArtifactCard";
import { DEMO_PERIOD_BADGE, DEMO_PRODUCT_NAME, demoArtifactName } from "./demoContent";
import { Chip } from "../../shared/ui/Chip";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Stamp } from "../../shared/ui/Stamp";

/**
 * The terminal state: this order is done and the file has gone.
 *
 * THE PARAGRAPH IS THE PRODUCT CLAIM, not a summary. It names the three gates
 * an order passes — sign-off at intake, completeness before extraction, a
 * reviewer on every flagged value — in the order they happened, because the
 * sheet's whole worth is that all three are true of it. A generic "your report
 * has been delivered" would say nothing a mail client couldn't.
 *
 * "field by field" is the phrase to keep. It is the difference between a person
 * approving a report and a person approving each value in it, and it is the
 * claim the no-approve-all rule exists to protect.
 *
 * The stamp is SETTLED and it is the only place on this screen with weight —
 * nothing here is actionable, so nothing else competes for the eye. The
 * footnote about the 13 operational lines is the one caveat that has to travel
 * with the file: the sheet a client reads is not the QC checklist, and someone
 * who assumes it is will look for lines that were never meant to be printed.
 */
export function FinalizedNotice({
  orderId,
  deliveredLabel,
}: {
  orderId: string;
  /** Server-formatted where possible; omitted entirely rather than guessed. */
  deliveredLabel: string | null;
}) {
  return (
    <div data-testid="finalized-notice">
      <div className="mb-13">
        <Stamp tone="settled" size="xl">
          Finalized
        </Stamp>
      </div>

      <h1 className="mb-3 text-4xl font-semibold text-ink-primary">
        Order {orderId} delivered
      </h1>
      <p className="mx-auto mb-11 max-w-172 text-md leading-open text-ink-secondary">
        The abstractor sign-off was completed at intake, the completeness gate
        cleared before extraction, and every flagged value was approved by a
        reviewer, field by field.
      </p>

      <div className="mb-11 flex flex-wrap items-center justify-center gap-5">
        <Eyebrow variant="field">Product</Eyebrow>
        <span className="text-md font-semibold text-ink-primary">{DEMO_PRODUCT_NAME}</span>
        {/*
          `normal-case` because `Chip` uppercases and the design does not here.
          Every other chip in the product is a state word, where caps read as a
          label; this one is a DATE SPAN, and "07/18/1986 – 07/18/2026" shouted
          in 9px letterspaced caps stops being a number you can read at a glance.
          Size and tracking go with it for the same reason, and they are what
          keep the row on ONE line: `tracking-label` on forty characters spends
          52px on air alone, which pushed the badge under the product name.
        */}
        <Chip
          tone="action"
          size="md"
          shape="mono"
          bordered
          className="text-xs tracking-normal normal-case"
        >
          {DEMO_PERIOD_BADGE}
        </Chip>
      </div>

      <ArtifactCard filename={demoArtifactName(orderId)} productName={DEMO_PRODUCT_NAME} />

      <p className="mx-auto mt-7 max-w-145 text-xs leading-open text-ink-muted">
        The sheet declares the sign-off was completed and states the product and
        period — the 13 operational lines are internal QC, not printed for the
        client.
      </p>
      {deliveredLabel === null ? null : (
        <p data-testid="delivered-at" className="mt-6 text-xs text-ink-muted">
          {deliveredLabel}
        </p>
      )}
    </div>
  );
}
