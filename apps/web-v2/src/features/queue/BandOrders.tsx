import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { QueueBand, QueueBandOrder } from "@titlepipe/contract";
import { OrderRow } from "../../entities/order/OrderRow";
import { OrderStatusChip } from "../../entities/order/OrderStatusChip";
import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { DividedSection } from "../../shared/ui/ListRow";
import { EmptyPanel } from "../../shared/ui/EmptyPanel";

/** How loud a row's control is. Never wax — see the accent rule below. */
export type BandPress = "solid" | "outlined";
/**
 * The inside of a band: its rows, or the honest statement of why there are none.
 *
 * RULE: the count is the SERVER'S (§4.3, and the contract says so on the field).
 * FAILURE PREVENTED: `orders.length` is never rendered. The row list is scoped
 * to what this caller may open and the census is not, so a reviewer with two of
 * four held orders in reach must not be shown "2" — a count that shrank with
 * your permissions reads as work disappearing. `.length` appears below only as a
 * PREDICATE, and where it disagrees with the census the band says so.
 *
 * RULE: an empty band and a band you cannot see into are different statements.
 * FAILURE PREVENTED: `count === 0` is the resolved-and-empty case and gets the
 * band's own copy; `count > 0` with no rows is not empty at all, and "Nothing
 * held." over four held orders contradicts the server on its own line.
 *
 * RULE: no band row offers a way to TAKE work (§4.4). FAILURE PREVENTED: the
 * action opens an order the server already says is YOURS (`row.mine`) and does
 * nothing else — no claim, no assign, no priority, and a row that is not yours
 * draws no control at all rather than a disabled one.
 *
 * RULE (2026-08-01 reskin): ONE SHEET PER BAND. The mockup's `.rows` is a single
 * card with hairline-divided `.orow`s inside it. FAILURE PREVENTED: a
 * `flex-col gap-4` of `Card`s drew five pieces of paper where the drawing has
 * one, and depth is this palette's separation mechanism (Card.tsx) — five
 * shadows stacked 8px apart read as clutter, one sheet reads as a list.
 *
 * RULE: ONE FULL-STRENGTH WAX ACTION PER SCREEN, and on the queue it is "Take
 * next order". FAILURE PREVENTED: every band row used the bare `<Button>`
 * default, which is `tone="action" fill="solid"` — the sealing wax. The queue
 * shipped FIVE wax buttons against a drawing that has one, and the button that
 * is the decision on the page had no more weight than a row control. `press`
 * states the loudness at the band, which is where the design decides it: the
 * mockup gives Mine the ink `.btn.solid` and Held/Delivered `.btn.line`.
 */
export function BandOrders({
  band,
  verb,
  press,
  empty,
}: {
  band: QueueBand;
  /** The word on a row you may open. `null` for a band that is a read only. */
  verb: string | null;
  /** How loud that control is. Never wax — the wax is spent on Take next order. */
  press: BandPress;
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
      {/*
       * ONE edge for the whole band, and now literally one. The mockup tones the
       * ROW's state chip red or amber; `QueueBandOrder` carries the server's
       * state WORD and no severity, and picking a colour by matching that string
       * is the client-side state machine hard rule 3 forbids. `held` itself is
       * the server's statement, so the band's sheet wears attention once. This
       * used to be a stripe per row — five assertions to the server's one.
       * CONTRACT GAP: a served `state_tone` on the band row would restore the
       * mockup's two chip tones without anyone reading the word.
       */}
      <Card accent={band.id === "held" ? "attend" : "none"}>
        <DividedSection>
          {band.orders.map((row) => (
            <BandOrderRow
              key={row.id}
              band={band.id}
              row={row}
              verb={verb}
              press={press}
            />
          ))}
        </DividedSection>
      </Card>
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
  press,
}: {
  band: QueueBand["id"];
  row: QueueBandOrder;
  verb: string | null;
  press: BandPress;
}) {
  const navigate = useNavigate();
  const open = () =>
    void navigate({ to: "/orders/$orderId/review", params: { orderId: row.id } });

  return (
    <OrderRow
      orderRef={row.order_ref}
      place={row.addr}
      where={row.place}
      note={row.waiting_on}
      /*
       * A DELIVERED ORDER IS NOT WAITING. `waited` is "how long it has sat",
       * which on a finished order is time since delivery — printing it under our
       * own WAITING label would claim an order that already went out is still
       * holding someone up. CONTRACT GAP: a served `when` phrase on the
       * delivered row would restore the design's "Delivered 2h ago"; composing
       * one here would be this screen writing the server's words for it.
       */
      waited={band === "delivered" ? undefined : (row.waited ?? undefined)}
      /* CONTRACT GAP: the same missing tone. The chip prints the server's word
         in the neutral family rather than asserting a severity nothing sent. */
      chips={
        row.state_label === null ? undefined : (
          <OrderStatusChip label={row.state_label} tone="neutral" />
        )
      }
      action={
        verb === null || !row.mine ? undefined : (
          <Button size="sm" tone="neutral" fill={press} onClick={open}>{verb}</Button>
        )
      }
    />
  );
}
