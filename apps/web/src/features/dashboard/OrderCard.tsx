import { Link } from "@tanstack/react-router";
import type { LifecycleOrder } from "@titlepipe/contract";
import { InnerPanel } from "../../components/ui";
import { OrderRef } from "../../entities/order/OrderRef";

/**
 * ONE ORDER ON THE BOARD, AND IT IS A LINK.
 *
 * `LifecycleOrder.id` (`intake.ts:188-206`) exists for exactly this: "`id` is
 * the join the census never had. A board card names an order and cannot open
 * it, because `order_ref` is a human reference and no endpoint takes one… A
 * card that names work nobody can reach is a dead end." So the card is an
 * anchor to `/orders/$orderId` rather than a button with a `navigate` in it —
 * middle-click, copy-link, open-in-new-tab and the back button are the
 * difference between a link and a click handler shaped like one.
 *
 * ══ `state_label` IS PRINTED AND NEVER READ ════════════════════════════════
 *
 * It is a FREE STRING and deliberately not an enum. `intake.ts:264-272` gives
 * the reason in the neighbouring `LifecycleStamp`: "An enum is an invitation to
 * `switch` on it, and a `switch` on a lifecycle word is the same state machine
 * moved one line down." So there is no map from the string to a tone, no glyph
 * chosen by matching it, and no capsule — every one of those would require this
 * component to have an opinion about what "Package incomplete" means, which is
 * hard rule 3's state machine wearing a colour. It renders as words, in the
 * server's words, and `null` renders as nothing at all.
 *
 * Rule 6 agrees from the other side: a coloured capsule is spent at moments of
 * record — released, quarantine clear, T1 — and a stage the order is merely
 * sitting in is not one.
 *
 * ══ WHAT IS ON `LifecycleOrder` AND NOT ON THIS CARD ═══════════════════════
 *
 * `waited` ("3h 12m", "2d 1h") is NOT drawn, anywhere, ever. INVARIANT 23 and
 * root AGENTS.md ban timers, pace language and time estimates outright, and an
 * elapsed-wait clock on every card is the throughput board those rules exist to
 * refuse. It is read off the wire because the schema carries it; it is not
 * rendered because the product does not have that surface.
 *
 * `waiting_on` is not drawn either, and that one is a fit judgement rather than
 * a refusal: the SERVER'S sentence per order is long-form prose ("Waiting on
 * the abstractor to add documents") and a seventh of a screen is not where it
 * reads. The column header carries `LifecycleStage.waiting_on`, which is the
 * same question answered at the altitude the board draws.
 *
 * `mine` IS drawn, because the contract asks for it by name:
 * `intake.ts:198-200` calls `mine` and `state_label` "the two facts the board
 * draws that could otherwise only be guessed: whose work it is, and the
 * SERVER'S WORD for why it stopped."
 */
export function OrderCard(props: { readonly order: LifecycleOrder }) {
  const order = props.order;

  return (
    <li>
      <Link
        to="/orders/$orderId"
        params={{ orderId: order.id }}
        data-order-card={order.id}
        className="tp-state block rounded-md"
      >
        {/*
         * The 10px rung inside the column's 14px card (rule 5: inner = outer −
         * gap). `InnerPanel` rather than a hand-rolled div because nested Cards
         * are forbidden and this is the barrel's answer to that shape; the
         * `Link` wraps it rather than the reverse so the whole panel is the hit
         * target and one focus ring surrounds it.
         */}
        <InnerPanel
          padding="none"
          className="flex flex-col gap-2 px-6 py-5 hover:bg-row-hover"
        >
          {/* Rule 3's first named example: an order ref is data, so it is mono. */}
          <OrderRef orderRef={order.order_ref} emphasis="subject" />

          <span className="font-sans text-meta leading-close text-ink-secondary">
            {order.addr}
          </span>

          <span className="font-sans text-label leading-flat text-ink-muted">
            {order.county}
          </span>

          {order.state_label !== null && (
            <span
              data-state-label={order.state_label}
              className="font-sans text-label leading-flat font-semibold text-ink-secondary"
            >
              {order.state_label}
            </span>
          )}

          {order.mine && (
            <span className="font-sans text-label leading-flat text-ink-muted">
              Yours
            </span>
          )}
        </InnerPanel>
      </Link>
    </li>
  );
}
