import type { Order } from "@titlepipe/contract";
import { OrderRef } from "../../entities/order/OrderRef";

/**
 * THE SERVED ORDER — the whole of what the queue draws, and the whole of what
 * `QueueNextResponse` carries (`endpoints.ts:70`: `{ order: Order | null }`).
 *
 * ══ WHAT THE DESIGN'S ROW HAD THAT THIS DOES NOT ═══════════════════════════
 *
 *   - NO `Assigned` COLUMN. `INVARIANTS:82-83` — no cherry-picking — and the
 *     contract has no assignment field on `Order` (`entities.ts:32-63` is the
 *     exhaustive shape). An order you were served is by definition yours; a
 *     column naming who holds it is furniture for a list, and there is no list.
 *   - NO `Due`, NO SLA CHIP. `INVARIANTS:84-85`: no timers and no time
 *     ESTIMATES, an estimate being a pace indicator. There is no SLA field
 *     anywhere in the contract to bind one to, which is the same refusal
 *     expressed as an absence.
 *   - NO `Open →`. Taking a specific row is the cherry-pick. The single primary
 *     action lives on the card because there is exactly one order to act on.
 *
 * ══ NULL IS A STATEMENT, NEVER A DASH ══════════════════════════════════════
 *
 * `entities.ts:40-60`: `product`, `period_label` and `pages` are nullable, and
 * null means "no resolved product" / "no page count" — an order that failed
 * validation has no product, a package nobody could read has no page count. `0`
 * would be a count, and a count asserts somebody looked. So each absent value
 * prints the server's meaning in words. The design's `—` collapses all of that
 * into one grey glyph.
 *
 * `status` and the timestamps are NOT drawn. `status` is `OrderStatus`, one of
 * three different state machines the design collapses into a single 1-5 rail
 * (ANALYSIS-screens §3), and a timestamp beside a queued order is one keystroke
 * away from "how long has this been sitting", which is §4.5's pace language.
 */
export function ServedOrder(props: { readonly order: Order }) {
  const { order } = props;

  return (
    <div className="flex flex-col gap-8 px-12 py-10">
      <div className="flex items-baseline gap-8">
        {/*
         * Rule 3: an order ref is data, so it is mono. `spotlight` is the 28px
         * accent draw the design gives the subject of a screen.
         *
         * `order-ref` is the testid `queue.spec` #1 counts, and counting it is
         * the assertion: `toHaveCount(1)` IS "no list". The id lives on this
         * wrapper rather than inside `OrderRef` because that component is drawn
         * many times per screen elsewhere in the product, and a testid that
         * appears N times cannot express "exactly one".
         */}
        <span data-testid="order-ref">
          <OrderRef orderRef={order.external_ref} emphasis="spotlight" />
        </span>
        <span className="text-body font-semibold leading-close text-ink-primary">
          {order.jurisdiction}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-14 gap-y-6">
        <Fact
          term="Product"
          value={order.product}
          absent="No resolved product — the order did not pass validation"
        />
        <Fact
          term="Period"
          value={order.period_label}
          absent="No period on record"
        />
        <Fact
          term="Package"
          value={order.pages === null ? null : `${order.pages} pages`}
          absent="Page count unread — nobody could read the package"
          data
        />
        <Fact term="County" value={`${order.county}, ${order.state}`} />
      </dl>
    </div>
  );
}

/**
 * One server fact. `absent` is REQUIRED wherever the wire may say null, so a
 * missing value is typed rather than blank (rule 14, applied to an order-level
 * fact rather than to a field value).
 */
function Fact(props: {
  readonly term: string;
  readonly value: string | null;
  readonly absent?: string;
  readonly data?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <dt className="text-label font-bold leading-flat text-ink-faint">
        {props.term}
      </dt>
      {props.value === null ? (
        <dd className="text-meta leading-close text-ink-faint">
          {props.absent ?? "Not stated"}
        </dd>
      ) : (
        <dd
          className={
            props.data === true
              ? "font-mono text-meta leading-close tabular-nums text-ink-primary"
              : "text-meta leading-close text-ink-primary"
          }
        >
          {props.value}
        </dd>
      )}
    </div>
  );
}
