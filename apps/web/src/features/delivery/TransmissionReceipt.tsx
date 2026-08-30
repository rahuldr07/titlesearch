import type { DeliveryWithReport } from "@titlepipe/contract";
import { Card, CardBody, CardHeader } from "../../components/ui";
import { ClerkStamp } from "../../entities/evidence/ClerkStamp";
import { ReceiptStep } from "./ReceiptStep";

/**
 * THE TRANSMISSION RECEIPT — the four drawn steps, off the wire.
 *
 * ⚠ RULED 2026-08-29 — `docs/frontend/design-2026-08/RULING-2026-08-29.md`.
 * The reference draws four named, timestamped steps (signed → digest →
 * transmitted → acknowledged). The pre-ruling refusal stood on
 * `DeliveryStatus` being `z.string()` and OPEN; the ruling closed the enum
 * and put the steps ON THE DELIVERY (`Delivery.receipt`), so the rows below
 * are the SERVER's list printed in the server's order — a step is never
 * derived from `status` here, and an unlit step is one the record says has
 * not happened.
 *
 * The prototype's row is a three-column grid — time, mark, then what/who
 * stacked — under a header whose right end names the transport. That shape is
 * kept, with the server's status member in the transport chip.
 *
 * The clerk stamp is rule 8: a delivery that reached somebody is a moment of
 * record, and the two values on it — the method and the terminal instant —
 * are the server's own. A delivery that reached nobody gets no stamp.
 *
 * ══ A FAILURE HERE IS TRANSIT, NEVER QUALITY ═══════════════════════════════
 *
 * entities.ts states it and the tone follows it: a bounced delivery is
 * `attend`, not `halt`. The report is fine; the pipe was not.
 */
export function TransmissionReceipt({ delivery }: { readonly delivery: DeliveryWithReport }) {
  const reached = delivery.delivered_at !== null;
  return (
    <Card padding="none">
      <CardHeader>
        <span>Transmission receipt</span>
        <span
          data-testid="delivery-status"
          className="font-mono text-label leading-flat font-semibold text-ink-muted"
        >
          {`${delivery.status} · ${delivery.method}`}
        </span>
      </CardHeader>

      <CardBody className="flex flex-col gap-8">
        {/* A log, so an ordered list: the steps are in the server's order. */}
        <ol className="flex flex-col">
          {delivery.receipt.map((step) => (
            <ReceiptStep
              key={step.id}
              at={step.at}
              settled={step.done}
              what={step.what}
              detail={step.who}
            />
          ))}
        </ol>

        {reached && delivery.delivered_at !== null && (
          <div className="flex justify-end">
            <ClerkStamp caption="Transmitted" detail={`${delivery.method} · ${delivery.delivered_at}`} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
