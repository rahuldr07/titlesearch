import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useHotkeys } from "react-hotkeys-hook";
import type { Order } from "@titlepipe/contract";
import { usePassOrder } from "./queries";
import { PassControl } from "../../entities/order/PassControl";
import { OrderStatusChip } from "../../entities/order/OrderStatusChip";
import { Card, CardBody } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Button } from "../../shared/ui/Button";

/**
 * THE one order the server chose. Never a row in a list, and there is no second
 * card to compare it against — `queue.spec` #1 asserts the next queued order
 * appears nowhere on this page.
 *
 * Order-scoped interaction lives here rather than on the screen because every
 * bit of it is meaningless without an order: the hotkeys cannot fire, the pass
 * cannot be sent, and the card only mounts when the server has handed one over.
 *
 * `passedRef` deliberately OUTLIVES the order it names. A pass invalidates the
 * query and a different order arrives underneath; the note has to stay long
 * enough to say which one went back, so this component is never keyed by order.
 *
 * CONTRACT GAP: the design's product chip ("60-year search") and its size line
 * ("92 pages · 14 read in full") have no carrier — `Order` has no product,
 * period or page count. The status chip and the jurisdiction/client line are
 * what this endpoint actually supplies, rendered in the design's slots.
 */
export function NextOrderCard({ order }: { order: Order }) {
  const navigate = useNavigate();
  const pass = usePassOrder();
  const [passing, setPassing] = useState(false);
  const [passedRef, setPassedRef] = useState<string | null>(null);

  const take = () =>
    void navigate({ to: "/orders/$orderId/review", params: { orderId: order.id } });

  // Hotkeys do not fire inside inputs by default, which is what keeps `p` and
  // Enter from firing while the reviewer is typing a pass reason (§7 scopes,
  // and `hard.spec` #5 pins the general rule).
  useHotkeys("p", () => setPassing(true), { preventDefault: true }, [order]);
  useHotkeys("enter", () => { if (!passing) take(); }, { preventDefault: true }, [order, passing]);

  return (
    <>
      {passedRef === null ? null : (
        <p data-testid="passed-note" className="text-base text-ink-secondary">
          You passed {passedRef}. It went back to the queue with your reason.
        </p>
      )}

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center justify-between gap-8">
            <div className="min-w-0">
              <Eyebrow variant="field" tone="action">Next order in line</Eyebrow>
              <div className="mt-3 flex flex-wrap items-center gap-5">
                <span
                  data-testid="order-ref"
                  className="font-mono text-xl font-semibold text-ink-primary"
                >
                  {order.external_ref}
                </span>
                {/* `{county} · {state}`, never "{county} County" — a literal
                    "County" would be the screen asserting a jurisdiction type
                    the server never sent, and Louisiana ships parishes. */}
                <span className="text-sm text-ink-secondary">
                  {order.county} · {order.state}
                </span>
                <OrderStatusChip label={order.status} tone="action" />
              </div>
              <p className="mt-3 text-sm text-ink-secondary">
                {order.jurisdiction} · {order.client_id}
              </p>
            </div>

            {passing ? null : (
              <div className="flex shrink-0 flex-wrap gap-4">
                <Button size="lg" onClick={take}>Take next order →</Button>
                <Button size="lg" fill="outlined" tone="neutral" onClick={() => setPassing(true)}>
                  Pass — say why
                </Button>
              </div>
            )}
          </div>

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
          ) : null}

          <p className="mt-6 text-xs text-ink-secondary">
            Keys: <span className="font-mono">⏎</span> take it ·{" "}
            <span className="font-mono">P</span> pass
          </p>
        </CardBody>
      </Card>
    </>
  );
}
