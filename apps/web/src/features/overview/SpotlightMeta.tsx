import type { Order } from "@titlepipe/contract";

/**

 * ROW 3 OF THE SPOTLIGHT — what was ordered, over what span, in how many pages. The

 * prototype draws it as `product pill · Client: … · pages`, 13px mono `#6E7480`, with

 * a "•" between items.

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

/**

 * The row's separator, drawn as its own element rather than baked into each label, so

 * that an item the order does not carry takes its separator with it — a leading or

 * doubled bullet is how a conditional row announces the field it is…

 */
function Dot() {
  return (
    <span aria-hidden className="text-ink-disabled">
      •
    </span>
  );
}
