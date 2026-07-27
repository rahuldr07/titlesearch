import { useQuery } from "@tanstack/react-query";
import type { DeliveryWithReport } from "@titlepipe/contract";
import { deliveriesQuery, useRetryDelivery } from "./queries";
import { ApiError } from "../../shared/api";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Chip } from "../../shared/ui/Chip";
import { Button } from "../../shared/ui/Button";
import { formatRecordingDate } from "../../shared/date";

type Delivery = DeliveryWithReport;

/**
 * Deliveries, grouped by the order they belong to.
 *
 * A FAILED DELIVERY IS A TRANSIT STATE, NEVER A QUALITY ONE
 * (`delivery-complaints.spec` #1). The report was right; the pipe was blocked.
 * The screen says so in words because the two get confused constantly, and
 * treating a bounced email as a quality failure sends someone re-reviewing a
 * report that was never wrong.
 *
 * EVERY VERSION STAYS LISTED (`delivery-complaints.spec` #2). The version list
 * IS the defect record: v2 existing at all means v1 went out wrong, and
 * collapsing to "latest" would erase the only evidence that happened.
 */
export function DeliveryScreen() {
  const { data, isPending, isError } = useQuery(deliveriesQuery);
  const retry = useRetryDelivery();

  if (isError) return <p className="text-base text-state-halt-ink">Deliveries unavailable.</p>;
  if (isPending) return <p className="text-base text-ink-secondary">Loading deliveries…</p>;

  const byOrder = new Map<string, Delivery[]>();
  for (const d of data.deliveries) {
    const orderId = d.report?.order_id ?? "unknown";
    byOrder.set(orderId, [...(byOrder.get(orderId) ?? []), d]);
  }

  return (
    <div className="flex flex-col gap-8">
      <Eyebrow variant="screen">Delivery</Eyebrow>

      {[...byOrder.entries()].map(([orderId, deliveries]) => {
        const failed = deliveries.find((d) => d.status === "failed_transit");
        const versions = deliveries
          .map((d) => d.report?.version)
          .filter((v): v is number => typeof v === "number")
          .sort((a, b) => a - b);

        return (
          <Card key={orderId} data-testid={`delivery-${orderId}`} accent={failed ? "attend" : "none"}>
            <CardHeader filled>
              <span className="font-mono text-md font-semibold">{orderId}</span>
              <Chip
                data-testid="delivery-status"
                tone={failed ? "attend" : "settled"}
                size="sm"
                bordered
              >
                {failed
                  ? "FAILED IN TRANSIT"
                  : versions.length > 1
                    ? `DELIVERED · ${versions.length} VERSIONS`
                    : "DELIVERED"}
              </Chip>
            </CardHeader>

            <CardBody className="flex flex-col gap-5">
              {failed ? (
                <>
                  <p className="text-base leading-body text-ink-secondary">
                    This is a transit failure — not a quality problem. The report
                    is unchanged and retrying sends the same file.
                  </p>
                  <p className="font-mono text-xs text-ink-muted">{failed.evidence}</p>
                  <div>
                    <Button
                      size="sm"
                      data-testid="retry-btn"
                      disabled={retry.isPending}
                      onClick={() => retry.mutate(failed.id)}
                    >
                      Retry this delivery
                    </Button>
                  </div>
                  {retry.isError ? (
                    <p data-testid="retry-note" role="alert" className="text-xs font-semibold text-state-halt-ink">
                      server: {retry.error instanceof ApiError ? retry.error.message : "unavailable"}
                    </p>
                  ) : null}
                </>
              ) : null}

              <div>
                <Eyebrow variant="caption">
                  {versions.length > 1 ? "Versions — this list is the defect record" : "Version"}
                </Eyebrow>
                <ul className="mt-2 flex flex-col gap-2">
                  {deliveries.map((d) => (
                    <li key={d.id} className="font-mono text-base text-ink-primary">
                      v{d.report?.version ?? "?"} · {d.method} ·{" "}
                      {d.delivered_at
                        ? formatRecordingDate(d.delivered_at.slice(0, 10)) ?? d.delivered_at
                        : "not delivered"}
                      {d.evidence ? (
                        <span className="ml-3 text-xs text-ink-muted">{d.evidence}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
