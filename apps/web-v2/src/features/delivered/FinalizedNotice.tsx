import { ArtifactCard } from "./ArtifactCard";
import { SheetHeading } from "./SheetHeading";
import { demoArtifactName } from "./demoContent";
import { OrderContextRow } from "../../entities/order/OrderContextRow";
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
 *
 * THE PRODUCT AND THE PERIOD ARE THE ORDER'S, read from
 * `GET /api/orders/{id}/context` and drawn by `entities/order/OrderContextRow`
 * — the one component that owns that row anywhere in the app. They are nullable
 * and the row is dropped WHOLE when the product is unknown: the footnote below
 * claims the sheet "states the product and period", and a half-empty row under
 * that sentence would be the screen contradicting itself.
 *
 * THE RECEIPT'S CAPTION IS `PRODUCT`, the export's word on this screen. The
 * entity used to hard-code Review's `ORDERED` and this call site accepted it,
 * on the reasoning that one row cannot carry two words and forking the
 * component over a caption was the worse trade. It carries a `label` now, so
 * the trade is gone and all three surfaces print what the export prints:
 * ORDERED on Review, PRODUCT ORDERED at the gate, PRODUCT here.
 */
export function FinalizedNotice({
  orderId,
  product,
  periodLabel,
  deliveredLabel,
}: {
  /** The order's HUMAN reference — what the sheet the client holds carries. */
  orderId: string;
  /** Server-supplied. Null when no product is resolved on the order. */
  product: string | null;
  /** Server-composed label, never a span this screen assembles from dates. */
  periodLabel: string | null;
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

      {/*
        THE ITALIC LANDS ON `delivered`, which is the whole claim. RULE: the
        mockup emphasises the CLOSING phrase of a heading, and on this screen the
        closing word is the state — everything above it is an identifier. FAILURE
        PREVENTED: the order number in italic, which is the other candidate and
        is exactly wrong: a reference is read, not felt, and it is already set in
        the face that says so.
      */}
      <SheetHeading>
        Order {orderId} <em>delivered</em>
      </SheetHeading>
      <p className="mx-auto mb-11 max-w-172 text-md leading-open text-ink-secondary">
        The abstractor sign-off was completed at intake, the completeness gate cleared
        before extraction, and every flagged value was approved by a reviewer, field by
        field.
      </p>

      {/*
        ONE ROW, ONE SOURCE. This screen drew the ordered product and period
        itself — first from two hardcoded constants, then from the order context
        but still in markup copied from `OrderContextRow`, down to the comment
        explaining the chip's tracking. Two renderers of one row is how the
        fabrication survived as long as it did: the completeness screen read the
        server while this one printed a constant, and nothing on either screen
        said so. The row is the entity's now, and the receipt only decides
        whether to show it and where to put it.

        The wrapper centres it, because a receipt is read down the middle and
        every other block on this screen is centred. The row itself is left to
        the entity — a `justify-*` reaching inside a shared component is how two
        call sites start disagreeing about what the component is.
      */}
      {product === null ? null : (
        <div className="mb-11 flex justify-center">
          <OrderContextRow
            label="PRODUCT"
            productName={product}
            periodLabel={periodLabel}
          />
        </div>
      )}

      <ArtifactCard filename={demoArtifactName(orderId)} productName={product} />

      <p className="mx-auto mt-7 max-w-145 text-xs leading-open text-ink-muted">
        The sheet declares the sign-off was completed and states the product and period
        — the 13 operational lines are internal QC, not printed for the client.
      </p>
      {deliveredLabel === null ? null : (
        <p data-testid="delivered-at" className="mt-6 text-xs text-ink-muted">
          {deliveredLabel}
        </p>
      )}
    </div>
  );
}
