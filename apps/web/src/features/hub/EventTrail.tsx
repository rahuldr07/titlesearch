import type { OrderTimelineEvent } from "@titlepipe/contract";
import { Card, Empty } from "../../components/ui";
import { HubSectionLabel } from "./HubSectionLabel";

/**
 * The order's thread through the pipeline. Three refusals kept from the design:
 * the "SOC 2" and "immutable" claims (nothing in the contract backs either),
 * optimistic append (`INVARIANTS:39` — the trail appends when the server says it
 * has), and durations (`INVARIANTS:84` — two timestamps and a subtraction is a
 * timer). `kind` is `z.string()` and deliberately OPEN, so nothing switches on
 * it; the mark comes from `attend`, which the server owns.
 */
export function EventTrail(props: {
  readonly events: readonly OrderTimelineEvent[] | undefined;
}) {
  return (
    <Card className="flex flex-col gap-8">
      <HubSectionLabel>Event trail</HubSectionLabel>

      {props.events === undefined ? (
        <p className="text-meta leading-body text-ink-muted">
          The server has not sent this order's thread.
        </p>
      ) : props.events.length === 0 ? (
        <Empty
          title="Nothing recorded yet"
          reason="The server holds no events for this order. Events are appended by the pipeline, never by this screen."
        />
      ) : (
        <ol className="flex flex-col gap-6 text-meta">
          {props.events.map((event, index) => (
            <li
              // `at` + `kind` is not unique — an order can be delivered twice.
              // The index is the row's position in the server's own ordering.
              key={`${event.at}-${event.kind}-${String(index)}`}
              data-event-kind={event.kind}
              data-event-attend={event.attend}
              className="flex gap-6 rounded-lg p-4 hover:bg-surface-sunken"
            >
              <span
                aria-hidden
                className={
                  event.attend
                    ? "shrink-0 font-mono text-meta leading-body text-state-attend"
                    : "shrink-0 font-mono text-meta leading-body text-state-settled"
                }
              >
                {event.attend ? "◆" : "✓"}
              </span>
              {event.attend && <span className="sr-only">needs attention</span>}

              {/* Rule 3: a timestamp is data, printed as the server sent it —
                  never parsed, never re-rendered in a locale (§8). */}
              <span className="w-70 shrink-0 font-mono text-label leading-body whitespace-nowrap tabular-nums text-ink-muted">
                {event.at}
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-meta font-semibold leading-close text-ink-primary">
                  {event.label}
                </span>
                {event.detail !== null && (
                  <span className="text-meta leading-body text-ink-secondary">
                    {event.detail}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
