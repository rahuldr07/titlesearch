import type { DeliveryWithReport } from "@titlepipe/contract";
import { Card, CardBody, CardHeader, cx } from "../../components/ui";
import { ContractGap } from "../../entities/contract/ContractGap";

/**
 * THE TRANSMISSION RECEIPT, WITH THE STEPS THE SERVER ACTUALLY SENDS.
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
 * carries: the method, the server's status STRING verbatim, the two instants,
 * and the evidence line. Timestamps are mono (rule 3) and pass through
 * untouched (`shared/date.ts` — a server's instant is not re-rendered here).
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
      <CardHeader>Transmission receipt</CardHeader>
      <CardBody className="flex flex-col gap-8">
        <dl className="flex flex-col gap-6">
          <Line term="Method" value={delivery.method} data />
          <Line term="Status" value={delivery.status} data testId="delivery-status" />
          <Line
            term="Attempted"
            value={delivery.attempted_at ?? "not attempted"}
            data={delivery.attempted_at !== null}
          />
          <Line
            term="Delivered"
            value={delivery.delivered_at ?? "reached nobody — retryable transit failure"}
            data={reached}
          />
          <Line
            term="Evidence"
            /* Rule 14's argument applied to an evidence line: a null is a
               STATEMENT (nothing was recorded), never a blank. */
            value={delivery.evidence ?? "none recorded"}
            data={false}
          />
        </dl>

        <ContractGap
          drawn="Signed → hash → transmitted → acked, each timestamped (design §Screens 9)"
          has={
            <>
              `DeliveryStatus` is `z.string()` (enums.ts:118) and enums.ts:112-115
              marks it OPEN until the Flask models are ported, so the four steps
              cannot be named. `Delivery` also carries two instants, not four:
              `attempted_at` and `delivered_at` (entities.ts:231-232). The status
              above is the server's own string, printed.
            </>
          }
          needs={
            <>
              The real `DeliveryStatus` members, and — if the receipt is a
              sequence rather than a state — a per-step record with its own
              timestamp. Root AGENTS.md: do not build past `OPEN`.
            </>
          }
        />
      </CardBody>
    </Card>
  );
}

function Line({
  term,
  value,
  data,
  testId,
}: {
  readonly term: string;
  readonly value: string;
  readonly data: boolean;
  readonly testId?: string | undefined;
}) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-8">
      <dt className="font-sans text-label leading-airy font-bold text-ink-faint">{term}</dt>
      <dd
        {...(testId === undefined ? {} : { "data-testid": testId })}
        className={cx(
          "text-meta leading-body text-ink-secondary",
          // Rule 3: mono for DATA — instants, methods, status codes. The
          // fallback sentences are prose and stay sans.
          data ? "font-mono" : "font-sans",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
