import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { QueueBand, QueueBandOrder } from "@titlepipe/contract";
import { OrderRow } from "../../entities/order/OrderRow";
import { OrderStatusChip } from "../../entities/order/OrderStatusChip";
import { Button } from "../../shared/ui/Button";
import { EmptyPanel } from "../../shared/ui/EmptyPanel";

/**
 * The inside of a band: its rows, or the honest statement of why there are none.
 *
 * RULE: the count is the SERVER'S (§4.3, and the contract says so on the field).
 * FAILURE PREVENTED: `orders.length` is never rendered. The row list is scoped
 * to what this caller may open and the census is not, so a reviewer with two of
 * four held orders in reach must not be shown "2" — a count that shrank with
 * your permissions reads as work disappearing rather than as work you are not
 * allowed to look at. `.length` appears below only as a PREDICATE, and where it
 * disagrees with the census the band says so instead of quietly showing fewer.
 *
 * RULE: an empty band and a band you cannot see into are different statements.
 * FAILURE PREVENTED: `count === 0` is the resolved-and-empty case and gets the
 * band's own copy; `count > 0` with no rows is not empty at all, and printing
 * "Nothing held." over four held orders would be the screen contradicting the
 * server on the same line as its own number.
 *
 * RULE: no band row offers a way to TAKE work (§4.4). FAILURE PREVENTED: the
 * action opens an order the server already says is YOURS (`row.mine`) and does
 * nothing else. There is no claim, no assign and no priority here; a row that is
 * not yours draws no control at all rather than a disabled one, so nobody is
 * invited to go and ask for it.
 */
export function BandOrders({
  band,
  verb,
  empty,
}: {
  band: QueueBand;
  /** The word on a row you may open. `null` for a band that is a read only. */
  verb: string | null;
  /** The band's own words for genuinely nothing there. */
  empty: ReactNode;
}) {
  if (band.count === 0) return empty;
  if (band.orders.length === 0)
    return (
      <EmptyPanel
        title="None of these are yours to open."
        body="The census beside the band name is the server's. The list is what your role reaches, and it is narrower."
      />
    );

  return (
    <div className="flex flex-col gap-4">
      {band.orders.map((row) => (
        <BandOrderRow key={row.id} band={band.id} row={row} verb={verb} />
      ))}
      {band.orders.length === band.count ? null : (
        <p className="px-1 text-xs text-ink-secondary">
          Not all of them are listed — the census is the server&rsquo;s, and the
          list is what your role reaches.
        </p>
      )}
    </div>
  );
}

function BandOrderRow({
  band,
  row,
  verb,
}: {
  band: QueueBand["id"];
  row: QueueBandOrder;
  verb: string | null;
}) {
  const navigate = useNavigate();
  const open = () =>
    void navigate({ to: "/orders/$orderId/review", params: { orderId: row.id } });

  return (
    <OrderRow
      orderRef={row.order_ref}
      place={`${row.addr} · ${row.place}`}
      note={row.waiting_on}
      /*
       * A DELIVERED ORDER IS NOT WAITING. `waited` is "how long it has sat",
       * which on a finished order is time since delivery — printing it under
       * our own WAITING label would have the screen claim an order that has
       * already gone out is still holding someone up. The export writes
       * "Delivered 2h ago" instead, and that sentence is not on the wire.
       * CONTRACT GAP: a served `when` phrase on the delivered row would restore
       * it; composing one from `waiting_on` + `waited` would be this screen
       * writing the server's words for it.
       */
      waited={band === "delivered" ? undefined : (row.waited ?? undefined)}
      /*
       * ONE edge for the whole band, not one per row. The export draws red for
       * an incomplete package and amber for an escalation; `QueueBandOrder`
       * carries the server's state WORD and no severity, and picking a colour by
       * matching that string is the client-side state machine hard rule 3
       * forbids. `held` itself is the server's statement — "stopped · needs
       * someone" — so the whole band wears attention and no row claims more.
       * CONTRACT GAP: a served `state_tone` on the band row would restore the
       * export's two edges without anyone reading the word.
       */
      stateEdge={band === "held" ? "attend" : "none"}
      /*
       * CONTRACT GAP: the same missing tone. The chip prints the server's word
       * in the neutral family rather than asserting a severity nothing sent.
       */
      chips={
        row.state_label === null ? undefined : (
          <OrderStatusChip label={row.state_label} tone="neutral" />
        )
      }
      action={
        verb === null || !row.mine ? undefined : (
          <Button size="sm" onClick={open}>
            {verb}
          </Button>
        )
      }
    />
  );
}
