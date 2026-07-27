import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useHotkeys } from "react-hotkeys-hook";
import { nextOrderQuery, usePassOrder } from "./queries";
import { PassControl } from "./PassControl";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Button } from "../../shared/ui/Button";
import { ScreenFailure } from "../../shared/ui/ScreenFailure";
import { OrderStatusChip } from "../../entities/order/OrderStatusChip";

/**
 * ONE order, chosen by the server. There is no list, no filter and no sort —
 * `GET /api/queue/next` has no browse counterpart by design, and `queue.spec`
 * #1 asserts the next queued order appears nowhere on this page. Work comes to
 * you; the system decides.
 *
 * Nothing here counts, times or paces anything (`queue.spec` #2, constraint 7).
 * No "3 orders waiting", no elapsed timer, and no ESTIMATE — an estimate is a
 * pace indicator wearing a helpful hat.
 */
export function QueueScreen() {
  const navigate = useNavigate();
  const { data, isPending, isError, error } = useQuery(nextOrderQuery);
  const pass = usePassOrder();
  const [passing, setPassing] = useState(false);
  const [passedRef, setPassedRef] = useState<string | null>(null);

  const order = data?.order ?? null;

  // Hotkeys do not fire inside inputs by default, which is what keeps `p` and
  // Enter from firing while the reviewer is typing a pass reason (§7 scopes,
  // and `hard.spec` #5 pins the general rule).
  useHotkeys("p", () => { if (order) setPassing(true); }, { preventDefault: true }, [order]);
  useHotkeys(
    "enter",
    () => { if (order && !passing) void navigate({ to: "/orders/$orderId/review", params: { orderId: order.id } }); },
    { preventDefault: true },
    [order, passing],
  );

  if (isError) return <ScreenFailure reference={error instanceof Error ? error.message : undefined} />;
  if (isPending) return <p className="text-base text-ink-secondary">Loading the next order…</p>;

  if (!order) {
    return (
      <Card>
        <CardBody className="text-center">
          <p className="font-semibold">Nothing is waiting.</p>
          <p className="mt-2 text-sm text-ink-secondary">
            Work comes to you — the system decides which order is next.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Eyebrow variant="screen">Next up</Eyebrow>

      {passedRef ? (
        <p data-testid="passed-note" className="text-base text-ink-secondary">
          You passed {passedRef}. It went back to the queue with your reason.
        </p>
      ) : null}

      <Card>
        <CardHeader filled>
          <Eyebrow variant="section">Order</Eyebrow>
          <span data-testid="order-ref" className="font-mono text-md font-semibold">
            {order.external_ref}
          </span>
          <OrderStatusChip label={order.status} tone="action" />
        </CardHeader>

        <CardBody>
          <dl className="flex flex-wrap gap-10">
            <Detail label="County">{order.county}, {order.state}</Detail>
            <Detail label="Jurisdiction">{order.jurisdiction}</Detail>
            <Detail label="Client">{order.client_id}</Detail>
          </dl>

          {passing ? (
            <PassControl
              pending={pass.isPending}
              onCancel={() => setPassing(false)}
              onSubmit={(reason) => {
                const ref = order.external_ref;
                pass.mutate(
                  { orderId: order.id, reason },
                  { onSuccess: () => { setPassedRef(ref); setPassing(false); } },
                );
              }}
            />
          ) : (
            <div className="mt-8 flex flex-wrap gap-4">
              <Button
                onClick={() => void navigate({ to: "/orders/$orderId/review", params: { orderId: order.id } })}
              >
                Take this order
              </Button>
              <Button fill="outlined" tone="neutral" onClick={() => setPassing(true)}>
                Pass — say why
              </Button>
            </div>
          )}

          <p className="mt-6 text-xs text-ink-secondary">
            Keys: <span className="font-mono">⏎</span> take it ·{" "}
            <span className="font-mono">P</span> pass
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Eyebrow variant="field" as="dt">{label}</Eyebrow>
      <dd className="mt-1 text-base text-ink-primary">{children}</dd>
    </div>
  );
}
