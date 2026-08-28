import type { OrderContextResponse, OrderSignoffResponse } from "@titlepipe/contract";
import { Card } from "../../components/ui";
import { HubSectionLabel } from "./HubSectionLabel";

/**
 * What was ordered, over what span, against how many pages, and who signed for
 * it. Drawn to the prototype's 120px label column.
 *
 * Four of the prototype's seven rows are not here. `OrderContextResponse`
 * (`intake.ts:301`) carries order_ref, product, period_label, pages and stamp
 * and nothing else, so the situs address, the tax parcel id, the jurisdiction
 * and the "Client & Order #" line have no member on the one read an
 * order-scoped screen can reach. CONTRACT GAP, not filled with a constant.
 *
 * The three nulls mean different things (`intake.ts:301`), so each absent value
 * prints its own meaning — the design's `—` says all three at once. The
 * signature is a record with no way to edit it (`INVARIANTS:75`), and policy
 * prefill never fills it in (`intake.ts:66`).
 */
export function SpecificationsGrid(props: {
  readonly context: OrderContextResponse | undefined;
  readonly signoff: OrderSignoffResponse | undefined;
}) {
  return (
    <Card className="flex flex-col gap-8">
      <HubSectionLabel>Abstract specifications</HubSectionLabel>

      {props.context === undefined ? (
        <p className="text-meta leading-body text-ink-muted">
          The server has not described this order.
        </p>
      ) : (
        <dl className="flex flex-col gap-5 text-meta">
          <Cell term="Order" value={props.context.order_ref} data />
          <Cell
            term="Product"
            value={props.context.product}
            absent="No resolved product — the order did not pass validation"
          />
          <Cell
            term="Period"
            value={props.context.period_label}
            absent="No period on record"
          />
          <Cell
            term="Package"
            value={props.context.pages === null ? null : `${props.context.pages} pages`}
            absent="Page count unread — nobody could read the package"
            data
          />
          <Cell
            term="Signed off by"
            value={props.signoff?.signed_by ?? null}
            absent="Not signed — policy may have suggested answers, but nobody has claimed them"
          />
          <Cell
            term="Signed at"
            value={props.signoff?.signed_at ?? null}
            absent="Not signed"
            data
          />
        </dl>
      )}
    </Card>
  );
}

/** `absent` is required wherever the wire may be null — rule 14 at order level. */
function Cell(props: {
  readonly term: string;
  readonly value: string | null;
  readonly absent?: string;
  readonly data?: boolean;
}) {
  return (
    <div className="flex gap-5 text-meta">
      <dt className="w-60 shrink-0 leading-body font-medium text-ink-muted">{props.term}</dt>
      {props.value === null ? (
        <dd className="min-w-0 flex-1 leading-body text-ink-muted">
          {props.absent ?? "Not stated"}
        </dd>
      ) : (
        <dd
          className={
            props.data === true
              ? "min-w-0 flex-1 font-mono leading-body font-semibold break-words tabular-nums text-ink-primary"
              : "min-w-0 flex-1 leading-body font-semibold break-words text-ink-primary"
          }
        >
          {props.value}
        </dd>
      )}
    </div>
  );
}
