import { useQuery } from "@tanstack/react-query";
import { orderContextQuery } from "./queries";
import { OrderContextRow } from "../../entities/order/OrderContextRow";

/**
 * "ORDERED · {product} · {period}" — the export's `:835-839`, the first thing
 * in the right pane and the only line on Review that says what was actually
 * bought.
 *
 * THE SCREEN HAD NO SUCH ROW AT ALL. A reviewer decided every field of a
 * two-owner search without the product or the abstracted period ever appearing
 * on the workstation, which is the fact that decides whether a 1998 deed is in
 * scope or noise. Completeness read it off the server, the delivered screen
 * printed two hardcoded constants, and Review omitted it — a fabrication on one
 * screen and an omission on another are the same defect from two sides, which
 * is why one entity now draws it for all three.
 *
 * NULL IS A STATEMENT, NOT A BLANK. An order that failed validation has no
 * resolved product, and a row headed ORDERED that cannot name what was ordered
 * is the fabrication in a quieter form — so the row is dropped whole.
 *
 * CONTRACT GAP: the export closes the row with a `config v4 · frozen` badge and
 * `OrderContextResponse` carries no config version. It is absent rather than
 * guessed; see `orderContextQuery`.
 */
export function OrderedRow({ orderId }: { orderId: string }) {
  const { data } = useQuery(orderContextQuery(orderId));

  if (data === undefined || data.product === null) return null;

  return (
    <div
      data-testid="ordered-row"
      className="flex-none border-b border-line-strong bg-surface-panel px-9 py-4"
    >
      <OrderContextRow productName={data.product} periodLabel={data.period_label} />
    </div>
  );
}
