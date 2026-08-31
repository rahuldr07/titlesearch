import type { DeliveryWithReport } from "@titlepipe/contract";
import { Card, CardBody, CardHeader } from "../../components/ui";
import { ClerkStamp } from "../../entities/evidence/ClerkStamp";
import { ReceiptStep } from "./ReceiptStep";

/**
 * The receipt steps are the server's list (`Delivery.receipt`) printed in the
 * server's order — a step is never derived from `status`, and an unlit step is
 * one the record says has not happened. A bounced delivery is `attend`, not
 * `halt`: the failure is transit, never quality.
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
