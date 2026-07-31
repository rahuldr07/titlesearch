import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Order } from "@titlepipe/contract";
import { useScreenHotkey } from "../../shared/keyboard";
import { usePassOrder } from "./queries";
import { PassControl } from "../../entities/order/PassControl";
import { Card, CardBody } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
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
 * THE PRODUCT AND THE PACKAGE SIZE ARE THE ORDER'S OWN (2026-07-30, Wave 2).
 * `Order.product`, `Order.period_label` and `Order.pages` carry what the design
 * put in its product chip and its size line, so neither is composed here and
 * neither is a constant. Both are NULLABLE and the card stays silent rather
 * than printing a placeholder: an order that failed validation has no resolved
 * product, and a package nobody could read has no page count — `null` says
 * that, and a `0` would claim somebody counted.
 *
 * CONTRACT GAP: the design's size line also reads "· 14 read in full". Nothing
 * on this response says how much of the package was carried forward, so the
 * card states the size and stops where the wire does.
 *
 * THE ONE ACCENTED CARD ON THE PAGE. The export gives this card a 1.5px
 * violet-tint edge and 18px of padding while every band row keeps a 1px rule,
 * so the card you are meant to act on is visibly the hero. Drawn on the kit's
 * default `Card` it wore the same edge as the "Nothing held." panel beside it.
 * It is an EDGE and not `Card`'s `accent` stripe on purpose: the stripe marks
 * "this block is the live one" inside a stack of peers, and this card has no
 * peers — its whole band is one card.
 *
 * NO KEY HINT ON THE CARD. The card used to close with `Keys: ⏎ take it · P
 * pass`. The export prints key hints on NO screen — the `?` map is the one
 * place they live, and the queue card it draws (`:249-264`) ends at its two
 * controls. The keys themselves are unchanged: `⏎` still takes and `p` still
 * opens the pass, they are simply no longer advertised in the card's own copy.
 * Nothing in `e2e/` asserted the line.
 *
 * NEITHER THE JURISDICTION SLUG NOR THE CLIENT ID IS INFORMATION. `clayton-ga`
 * and `cli_riverbend` are internal keys printed at a reviewer in the slot the
 * export spends on the package size; the county and state above already say
 * where the work is. The line now carries what the design puts there and
 * nothing else.
 */
export function NextOrderCard({ order }: { order: Order }) {
  const navigate = useNavigate();
  const pass = usePassOrder();
  const [passing, setPassing] = useState(false);
  const [passedRef, setPassedRef] = useState<string | null>(null);

  const take = () =>
    void navigate({ to: "/orders/$orderId/review", params: { orderId: order.id } });

  // PANE-LOCAL, VIA `useScreenHotkey` — never the bare `preventDefault: true`
  // document binding these were. That made EVERY Enter on /queue navigate to
  // review: the doors are anchors, so a keyboard-only reviewer could follow
  // none and each try ASSIGNED THEM AN ORDER. Both stand down while a control
  // or a field has focus and while the `?` map is up (`queue-keys.spec`).
  useScreenHotkey("p", () => setPassing(true), [order]);
  useScreenHotkey("enter", () => { if (!passing) take(); }, [order, passing]);

  return (
    <>
      {passedRef === null ? null : (
        <p data-testid="passed-note" className="text-base text-ink-secondary">
          You passed {passedRef}. It went back to the queue with your reason.
        </p>
      )}

      <Card className="border-(length:--stroke-emphasis) border-action-border">
        <CardBody className="p-9">
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
                {/* The product is the SERVER'S word, only cased by the chip —
                    the export draws this slot as a violet-tint chip and the app
                    previously spent it on the order's status, which the design
                    does not draw here at all. Nothing else on the page tells a
                    reviewer what search they are about to be handed. */}
                {order.product === null ? null : (
                  <Chip data-testid="order-product" tone="action" size="sm" bordered>
                    {order.product}
                  </Chip>
                )}
              </div>
              {order.pages === null ? null : (
                <p className="mt-4 text-sm text-ink-secondary">
                  <span className="font-mono font-semibold text-ink-primary">
                    {order.pages}
                  </span>{" "}
                  pages
                </p>
              )}
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
        </CardBody>
      </Card>
    </>
  );
}
