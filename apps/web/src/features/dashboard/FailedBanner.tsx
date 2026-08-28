import { Link } from "@tanstack/react-router";
import type { LifecycleOrder, LifecycleResponse } from "@titlepipe/contract";
import { OrderRef } from "../../entities/order/OrderRef";

/**
 * FAILED ORDERS, LIFTED TO THE TOP — because there is no failed COLUMN.
 *
 * `packages/mocks/src/workspace.ts:358-367` records the decision and the reason
 * it is a decision rather than an omission: "a `failed` column could not hold a
 * card at any point in the product's life — it would render permanently empty
 * however many orders had failed. A failed order sits in the stage it actually
 * stopped in, flagged, and the banner takes it from there." `failed` is a
 * boolean ON an order, not a stage it moves to, so a column for it would be a
 * lifecycle position the pipeline does not have.
 *
 * ══ THE FIGURE IS `LifecycleResponse.failed`, NOT THE LENGTH OF THIS LIST ══
 *
 * The same rule the stage columns obey (`intake.ts:217-222`), and here it bites
 * harder: `failed` is counted across the whole shop and the cards below are
 * scoped to what this reader may open, so for a reviewer the number is
 * routinely larger than the list. Printing the list length would tell somebody
 * whose permissions are narrow that fewer orders have failed than have failed.
 *
 * Nothing subtracts the two either. The count is printed, the openable ones are
 * listed, and the sentence says which is which — a difference nobody can audit
 * against the pipeline is not a figure this screen may publish
 * (`endpoints.ts:143-150`).
 *
 * ══ `failed` DECIDES ONE THING AND ONE THING ONLY ══════════════════════════
 *
 * That the order belongs here. It is not turned into a state, a stamp, a tone
 * on the card, a reordering of the column, or a reason — the server already
 * sent its own word for that in `state_label`, which this prints verbatim and
 * never reads.
 *
 * ══ WHY THIS IS NOT `Alert` AND NOT `Card` ═════════════════════════════════
 *
 * `Alert` takes `message` as a STRING rendered verbatim, which is exactly right
 * for a server refusal (INVARIANTS 14, 58) and leaves nowhere to put the joins
 * — and the joins are the point of the banner. `Card` has three tones (panel,
 * sunken, paper) and none of them is a halt register. So the region is
 * hand-written from the halt tokens, which is also what `entities/contract/
 * ContractGap.tsx` does for the same reason.
 */
export function FailedBanner(props: { readonly board: LifecycleResponse }) {
  if (props.board.failed === 0) return null;

  const failed: LifecycleOrder[] = props.board.stages.flatMap((stage) =>
    stage.orders.filter((order) => order.failed),
  );

  return (
    <section
      data-testid="failed-banner"
      aria-labelledby="failed-banner-title"
      className="flex flex-col gap-5 rounded-lg border border-state-halt-border bg-state-halt-surface px-12 py-10"
    >
      <div className="flex items-baseline gap-6">
        <h2
          id="failed-banner-title"
          className="font-sans text-meta leading-close font-bold text-state-halt"
        >
          Failed
        </h2>
        <span
          data-failed-count={props.board.failed}
          className="font-sans text-subject leading-flat font-bold tabular-nums text-state-halt"
        >
          {props.board.failed}
        </span>
      </div>

      <p className="max-w-320 font-sans text-meta leading-body text-ink-secondary">
        The board has no failed column. A failed order stays in the stage it
        stopped in, and is named here as well. The count is the server&rsquo;s
        across the whole shop; the links below are the ones you may open.
      </p>

      {failed.length > 0 && (
        <ul className="flex flex-wrap gap-4">
          {failed.map((order) => (
            <li key={order.id}>
              <Link
                to="/orders/$orderId"
                params={{ orderId: order.id }}
                data-failed-order={order.id}
                className="tp-state flex items-baseline gap-4 rounded-md border border-state-halt-border bg-surface-panel px-6 py-4 hover:bg-row-hover"
              >
                <OrderRef orderRef={order.order_ref} />
                {order.state_label !== null && (
                  <span className="font-sans text-label leading-flat font-semibold text-state-halt">
                    {order.state_label}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
