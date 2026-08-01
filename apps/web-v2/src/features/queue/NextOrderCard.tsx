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
 * `passedRef` deliberately OUTLIVES the order it names — a pass invalidates the
 * query and a different order arrives underneath, so the note has to stay long
 * enough to say which one went back, and this component is never keyed by order.
 *
 * THE PRODUCT AND THE PACKAGE SIZE ARE THE ORDER'S OWN (2026-07-30, Wave 2).
 * `Order.product` and `Order.pages` carry what the design puts in its product
 * chip and its size line, so neither is composed here and neither is a constant.
 * Both are NULLABLE and the card stays silent rather than printing a
 * placeholder: an order that failed validation has no resolved product, and a
 * package nobody could read has no page count — `null` says that, and a `0`
 * would claim somebody counted. CONTRACT GAP: the design's size line also reads
 * "· 14 read in full", and nothing on this response carries it.
 *
 * THE HERO IS PAPER AND DEPTH NOW, NOT AN EDGE (2026-08-01 reskin). RULE: depth
 * separates, hairlines divide, and the wax is spent once — here, on "Take next
 * order". FAILURE PREVENTED: this card carried a 1.5px accent border, so the
 * screen's one press sat inside a box drawn in the same colour and the eye had
 * two accents to choose between. The mockup's `.next` is the BRIGHTEST surface
 * in the system (`--card-high` = `surface-raised`) lifted on `--sh-2`, with no
 * edge at all: the card you are meant to act on is the one nearest you, and the
 * only red thing on the page is the button.
 *
 * ITS NUMERAL IS THE DISPLAY FACE, NOT MONO. `.n-ord` is Fraunces 30px at weight
 * 480 — `--text-5xl` and `--font-weight-demi`, whose token comments name this
 * exact use ("featured order number"). FAILURE PREVENTED: at `font-mono text-xl`
 * the served order read as a row id, indistinguishable from the six mono refs in
 * the bands above and below it. Refs inside the BANDS stay mono — they are a
 * column of identifiers, and identifiers are what the mono face is for.
 *
 * NO KEY HINT ON THE CARD, and no jurisdiction slug or client id. The `?` map is
 * the one place keys live; `⏎` still takes and `p` still opens the pass. The
 * meta line carries what the design puts there and nothing else.
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

      {/* `size="card"` keeps the mockup's 8px `--r-card`; only the SURFACE and
          the elevation change. `emphasis` would have brought 18px of radius the
          drawing does not give this card. */}
      <Card className="bg-surface-raised shadow-pop">
        <CardBody className="px-11 py-9">
          <div className="flex flex-wrap items-center justify-between gap-11">
            <div className="min-w-0">
              <Eyebrow variant="group">Next order in line</Eyebrow>
              <p
                data-testid="order-ref"
                className="mt-4 font-display text-5xl font-demi leading-flat opsz-100 text-ink-primary"
              >
                {order.external_ref}
              </p>
              {/* `.n-meta` — location and BOTH chips on one line. The page count
                  was a paragraph of its own below the card's fold; the mockup
                  files it beside the product because both answer the same
                  question, and neither is a sentence. `{county} · {state}`,
                  never "{county} County" — a literal "County" would assert a
                  jurisdiction type the server never sent, and Louisiana ships
                  parishes. The product chip is NEUTRAL, not the wax tint it
                  wore: a tinted chip was a third accent in a card whose whole
                  job is to have one. */}
              <div className="mt-5 flex flex-wrap items-center gap-5">
                <span className="text-md font-medium text-ink-secondary">
                  {order.county} · {order.state}
                </span>
                {order.product === null ? null : (
                  <Chip data-testid="order-product" size="sm" bordered>
                    {order.product}
                  </Chip>
                )}
                {order.pages === null ? null : (
                  <Chip shape="mono" size="sm" bordered className="tnum">
                    {order.pages} pages
                  </Chip>
                )}
              </div>
            </div>

            {passing ? null : (
              <div className="flex shrink-0 flex-wrap items-center gap-4">
                <Button size="lg" onClick={take}>Take next order →</Button>
                {/* `.btn.ghost` — the mockup gives Pass no box at all. Outlined,
                    it drew a second bordered control the same height as the wax
                    one: the "two buttons, pick one" reading §4.4 spends this
                    screen avoiding. Passing is allowed, not on offer. */}
                <Button size="lg" fill="ghost" tone="neutral" onClick={() => setPassing(true)}>
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
