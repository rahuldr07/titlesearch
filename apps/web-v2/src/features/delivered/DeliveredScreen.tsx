import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { deliveriesQuery } from "./queries";
import { pickDelivered } from "./deliveredRecord";
import { FinalizedNotice } from "./FinalizedNotice";
import { ReissuedSheet } from "./ReissuedSheet";
import { ReopenPanel } from "./ReopenPanel";
import { EmptyPanel } from "../../shared/ui/EmptyPanel";
import { Screen } from "../../shared/ui/Screen";

/**
 * The per-order delivery confirmation — the last screen an order has.
 *
 * NOT the deliveries list (`features/delivery`). That screen answers "what went
 * out and did any of it bounce?" across every order; this one answers "is this
 * order finished, and what exactly did the client receive?" for one. They read
 * the same endpoint and are otherwise unrelated: one is a work queue, this is a
 * receipt, and merging them would make the receipt something you scroll past.
 *
 * WHICH STATE IS SHOWN COMES FROM THE SERVER'S VERSION NUMBER, never from the
 * client's sense of what has happened. A v2 exists only because the server
 * issued one. The design computes this from browser state — a client-side state
 * machine, forbidden here — so the branch reads `report.version` and nothing
 * else.
 *
 * The confirmation is CENTRED AND NARROW on purpose. There is nothing to act on
 * and nothing to compare, so the layout should not offer the scanning posture
 * every working screen in this product does. It reads as a document, which is
 * what it is.
 */
export function DeliveredScreen({
  orderId,
  reopen = false,
}: {
  /** Omit to confirm the latest delivered report across all orders. */
  orderId?: string | undefined;
  /** Entered from a dispute elsewhere — the screen never opens this itself. */
  reopen?: boolean;
}) {
  const { data, isPending, isError } = useQuery(deliveriesQuery);
  const [reopenOpen, setReopenOpen] = useState(reopen);

  if (isError) {
    return <p className="text-base text-state-halt-ink">Delivery record unavailable.</p>;
  }
  if (isPending) {
    return <p className="text-base text-ink-secondary">Loading the delivery record…</p>;
  }

  const record = pickDelivered(data.deliveries, orderId);

  // A blank would read as "delivered, nothing to show" — the same silent-blank
  // failure `ScreenFailure` exists to prevent. Say which order and say why.
  //
  // `EmptyPanel` and not a bare line, because this branch is RESOLVED AND EMPTY:
  // the list arrived and holds no delivery for this order. The two branches
  // above are the *not loaded* cases and stay a different component on purpose —
  // once "no report yet" and "the request is still out" draw alike, nobody can
  // tell an unfinished order from a broken fetch. The testid moves to the
  // wrapper rather than onto a prop so the assertion still selects the whole
  // statement, text unchanged.
  if (record === null) {
    return (
      <Screen measure="460" pad="40" placement="centre">
        <div data-testid="nothing-delivered">
          <EmptyPanel
            title={
              orderId === undefined
                ? "No delivered report yet."
                : `Order ${orderId} has no delivered report yet.`
            }
          />
        </div>
      </Screen>
    );
  }

  return (
    <Screen measure="460" pad="40" placement="centre">
      <div className="text-center">
        {reopenOpen ? (
          <ReopenPanel orderId={record.orderId} onCancel={() => setReopenOpen(false)} />
        ) : null}

        {record.version > 1 ? (
          <ReissuedSheet orderId={record.orderId} />
        ) : (
          <FinalizedNotice
            orderId={record.orderId}
            deliveredLabel={record.deliveredLabel}
          />
        )}
      </div>
    </Screen>
  );
}
