import type { Order } from "@titlepipe/contract";

/**
 * Row 3: what was ordered, over what span, in how many pages.
 *
 * The prototype's middle item is "Client: …". `Order` carries `client_id` and
 * no client name (`entities.ts:32-37`); printing the id would put an opaque
 * join key where a reader expects a firm. The period the order was bought for
 * is the fact this shape does carry, so it holds the slot.
 */
export function SpotlightMeta(props: { readonly order: Order }) {
  const order = props.order;

  return (
    <div className="flex flex-wrap items-center gap-6 text-meta leading-close text-ink-muted">
      {order.product !== null && (
        <span className="rounded-lg bg-surface-app px-5 py-1 font-semibold text-ink-primary">
          {order.product}
        </span>
      )}
      {order.period_label !== null && (
        <>
          <Dot />
          <span>{order.period_label}</span>
        </>
      )}
      {order.pages !== null && (
        <>
          <Dot />
          <span className="font-mono">{order.pages} pp</span>
        </>
      )}
    </div>
  );
}

/** Its own element, so an absent item takes its separator with it. */
function Dot() {
  return (
    <span aria-hidden className="text-ink-disabled">
      •
    </span>
  );
}
