import type { OrderTimelineEvent } from "@titlepipe/contract";
import { useRead } from "../../app/useRead";
import { orderContext, orderTimeline } from "../../shared/queries";
import { QueryState } from "../../entities/state/QueryState";
import { cx } from "../../components/ui";

/**
 * THE ORDER SPINE ON THE WORKSTATION — identity, then what has been recorded
 * against this order.
 *
 * TWO READS, TWO `QueryState`s, AND THAT IS THE WHOLE POINT. The rule this
 * region exists for is `errors.spec` §"the order spine survives a timeline
 * failure": a partial failure degrades THAT REGION ONLY, and the spine still
 * renders its identity. Putting both reads behind one `QueryState` would let a
 * timeline 500 unmount the order's name — which is the failure the rule names.
 * They are separate on purpose; do not merge them.
 *
 * The identity comes from `/context` and the events from `/timeline`, so the
 * two fail independently at the network as well as in the render.
 */
export function OrderRail(props: { readonly orderId: string }) {
  const context = useRead(orderContext(props.orderId));
  const timeline = useRead(orderTimeline(props.orderId));

  return (
    <section
      data-testid="order-rail"
      aria-label="Order record"
      className="flex shrink-0 flex-col gap-5 border-b border-line-subtle bg-surface-panel px-9 py-7"
    >
      {/* IDENTITY. Its own read, its own failure — the id is printed from the
          route so the spine is never nameless, and the server's ref beside it. */}
      <div className="flex flex-wrap items-baseline gap-4">
        <span className="font-mono text-label leading-flat text-ink-muted">
          {props.orderId}
        </span>
        <QueryState query={context} of="this order's identity">
          {(data) => (
            <span className="font-mono text-meta leading-flat font-semibold text-ink-primary">
              {data.order_ref}
            </span>
          )}
        </QueryState>
      </div>

      <QueryState
        query={timeline}
        of="this order's timeline"
        /* NAMED, because `errors.spec` pins the name. The identity above has
           already rendered by the time this sentence appears — which is the
           assertion. */
        failedTitle="Order timeline unavailable"
      >
        {(data) => <Events events={data.events} />}
      </QueryState>
    </section>
  );
}

/**
 * What the server recorded, in the order it sent. Nothing is counted, ranked or
 * re-timed — INVARIANT 23 bars elapsed and pace, so `at` is printed as the
 * server's own stamp and never turned into a duration.
 */
function Events(props: { readonly events: readonly OrderTimelineEvent[] }) {
  if (props.events.length === 0) {
    return (
      <p className="text-label leading-body text-ink-faint">
        The server recorded no events against this order yet.
      </p>
    );
  }

  return (
    <ol data-testid="order-rail-events" className="flex flex-col gap-2">
      {props.events.map((event) => (
        <li
          key={`${event.at}:${event.kind}`}
          className="flex flex-wrap items-baseline gap-4"
        >
          <span className="font-mono text-label leading-flat text-ink-faint tabular-nums">
            {event.at}
          </span>
          <span
            className={cx(
              "text-label leading-flat font-semibold",
              event.attend ? "text-state-attend" : "text-ink-secondary",
            )}
          >
            {event.label}
          </span>
          {event.detail !== null && (
            <span className="min-w-0 flex-1 truncate text-label leading-flat text-ink-muted">
              {event.detail}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
