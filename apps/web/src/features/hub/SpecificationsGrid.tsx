import type { OrderContextResponse, OrderSignoffResponse } from "@titlepipe/contract";
import { Card } from "../../components/ui";
import { HubSectionLabel } from "./HubSectionLabel";

/**
 * What was ordered, over what span, against how many pages, and who signed for
 * it. The situs address, tax parcel id, jurisdiction and client line have no
 * member on `OrderContextResponse` — CONTRACT GAP, not filled with a constant.
 * The nulls mean different things, so each absent value prints its own
 * meaning. The signature is a record with no way to edit it, and policy
 * prefill never fills it in.
 */
export function SpecificationsGrid(props: {
  readonly context: OrderContextResponse | undefined;
  readonly signoff: OrderSignoffResponse | undefined;
}) {
  return (
    <Card className="flex flex-col gap-8">
      <HubSectionLabel>Abstract Specifications</HubSectionLabel>

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

/** `absent` says what a null on this row means — never a bare dash. */
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
