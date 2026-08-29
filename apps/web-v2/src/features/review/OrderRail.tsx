import { useQuery } from "@tanstack/react-query";
import { queueNextQuery, timelineQuery } from "./queries";
import { Card, CardBody } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Chip } from "../../shared/ui/Chip";

/**
 * THE ORDER'S STATES TRAVEL WITH IT (`navigation.spec` #6).
 *
 * Queue, escalation and delivery state are three different screens' worth of
 * facts about ONE order, and a reviewer looking at a field needs all three at
 * once: a field on an order that already shipped v1 is a different decision
 * from the same field on an order still in the queue.
 *
 * A PARTIAL FAILURE DEGRADES ONLY ITS REGION (`errors.spec` #2). The identity
 * comes from the URL and always renders; the history is a separate query and
 * says so when it is gone. A rail that vanished with its timeline would leave a
 * reviewer unable to tell which order is on screen — which is worse than
 * knowing less about it.
 */
export function OrderRail({ orderId }: { orderId: string }) {
  const timeline = useQuery(timelineQuery(orderId));
  const queue = useQuery(queueNextQuery);
  const stillQueued = queue.data?.order?.id === orderId;

  return (
    <Card data-testid="order-rail">
      <CardBody className="flex flex-col gap-4">
        <Eyebrow variant="caption">This order</Eyebrow>
        <span className="font-mono tnum text-md font-semibold text-ink-primary">
          {orderId}
        </span>

        {stillQueued ? (
          <Chip tone="attend" size="sm" bordered>
            still queued
          </Chip>
        ) : null}

        {timeline.isError ? (
          <p className="text-xs font-semibold text-state-halt-ink">
            timeline unavailable — the rest of this screen is unaffected
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(timeline.data?.events ?? []).map((event) => (
              <li key={`${event.kind}-${event.at}`} className="flex flex-col">
                <span
                  className={
                    event.attend
                      ? "text-xs font-semibold text-state-attend-ink"
                      : "text-xs text-ink-primary"
                  }
                >
                  {event.label}
                </span>
                {event.detail === null ? null : (
                  <span className="text-tiny text-ink-muted">{event.detail}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
