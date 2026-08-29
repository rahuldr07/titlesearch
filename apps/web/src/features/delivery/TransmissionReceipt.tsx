import type { DeliveryWithReport } from "@titlepipe/contract";
import { Card, CardBody, CardHeader } from "../../components/ui";
import { ClerkStamp } from "../../entities/evidence/ClerkStamp";
import { ContractGap } from "../../entities/contract/ContractGap";
import { ReceiptStep } from "./ReceiptStep";

/**
 * THE TRANSMISSION RECEIPT, WITH THE STEPS THE SERVER ACTUALLY SENDS.
 *
 * The prototype's row is a three-column grid — time, mark, then what/who
 * stacked — under a header whose right end names the transport. That shape is
 * kept exactly. What is NOT kept is its four rows.
 *
 * Design §Screens 9 draws four named, timestamped steps: signed → hash →
 * transmitted → acked. `DeliveryStatus` is `z.string()` (enums.ts:118) and
 * enums.ts:112-115 marks it explicitly OPEN until the Flask models are ported.
 * Root AGENTS.md: **do not build past `OPEN`.**
 *
 * So the four steps are NOT drawn. Naming them would mean deciding, in the
 * browser, what the server's status vocabulary is — and the design's four names
 * are a guess that the mock already contradicts: it emits `delivered` and
 * `failed_transit`, which are neither a subset nor a superset of the drawing.
 * A reader shown a four-step rail with three steps unlit would conclude a
 * delivery had stalled at "hash", which nothing in the record says.
 *
 * What renders instead is what a `Delivery` (entities.ts:226-235) genuinely
 * carries: the two instants as the two rows, the method and the evidence line
 * beneath them, and the server's status STRING verbatim in the header chip the
 * prototype gives the transport. Timestamps are mono (rule 3) and pass through
 * untouched (`shared/date.ts` — a server's instant is not re-rendered here).
 *
 * The clerk stamp is rule 8: a delivery that reached somebody is a moment of
 * record, and the two values on it — the method and the terminal instant — are
 * the server's own. A delivery that reached nobody gets no stamp.
 *
 * ══ A FAILURE HERE IS TRANSIT, NEVER QUALITY ═══════════════════════════════
 *
 * entities.ts:225 states it and the tone follows it: a bounced delivery is
 * `attend`, not `halt`. The report is fine; the pipe was not. Colouring it as a
 * defect would tell an ops reader to go and look at the abstract.
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
          {delivery.status}
        </span>
      </CardHeader>

      <CardBody className="flex flex-col gap-8">
        {/* A log, so an ordered list: the two instants are in order. */}
        <ol className="flex flex-col">
          <ReceiptStep
            at={delivery.attempted_at}
            settled={delivery.attempted_at !== null}
            what="Transmission attempted"
            detail={`method ${delivery.method}`}
          />
          <ReceiptStep
            at={delivery.delivered_at}
            settled={reached}
            what={
              reached
                ? "Delivered to the client"
                : "Reached nobody — retryable transit failure"
            }
            detail={delivery.evidence ?? "no evidence recorded"}
          />
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

/**
 * The gap belongs to the ENDPOINT, not to a row, so it is stated once per order
 * rather than once per delivery. A reissued order draws two receipts, and the
 * same paragraph printed twice under them reads as two separate findings.
 */
export function ReceiptGap() {
  return (
    <ContractGap
      drawn="Signed → hash → transmitted → acked, each timestamped (design §Screens 9)"
      has={
        <>
          `DeliveryStatus` is `z.string()` (enums.ts:118) and enums.ts:112-115
          marks it OPEN until the Flask models are ported, so the four steps
          cannot be named. `Delivery` also carries two instants, not four:
          `attempted_at` and `delivered_at` (entities.ts:231-232). The status in
          each header is the server's own string, printed.
        </>
      }
      needs={
        <>
          The real `DeliveryStatus` members, and — if the receipt is a sequence
          rather than a state — a per-step record with its own timestamp. Root
          AGENTS.md: do not build past `OPEN`.
        </>
      }
    />
  );
}
