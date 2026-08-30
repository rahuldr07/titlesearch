import type { OrderTimelineEvent } from "@titlepipe/contract";
import { Card, Empty } from "../../components/ui";
import { HubSectionLabel } from "./HubSectionLabel";

/**
 * The order's thread through the pipeline — ⚠ RULED 2026-08-29
 * (`docs/frontend/design-2026-08/RULING-2026-08-29.md`): titled and composed
 * as the reference draws it. The drawn title is "Immutable SOC 2 Event Trail"
 * (the prior refusal of the SOC 2 / immutable wording is superseded — it is
 * drawn, so it is built), and each row is the drawn composition: the mono
 * timestamp column, then the event's sentence with the trailing arrow glyph.
 *
 * Two refusals stand, because the reference draws nothing against them:
 * optimistic append (`INVARIANTS:39` — the trail appends when the server says
 * it has; a filed countersign lands here by the mock appending it and the
 * screen re-reading) and durations (`INVARIANTS:84`). `kind` is `z.string()`
 * and deliberately OPEN, so nothing switches on it; the attend register comes
 * from `attend`, which the server owns.
 */
export function EventTrail(props: {
  readonly events: readonly OrderTimelineEvent[] | undefined;
}) {
  return (
    <Card className="flex flex-col gap-8">
      <HubSectionLabel>Immutable SOC 2 Event Trail</HubSectionLabel>

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
        <ol className="flex flex-col gap-2 text-meta">
          {props.events.map((event, index) => (
            <li
              // `at` + `kind` is not unique — an order can be delivered twice.
              // The index is the row's position in the server's own ordering.
              key={`${event.at}-${event.kind}-${String(index)}`}
              data-event-kind={event.kind}
              data-event-attend={event.attend}
              className="flex gap-6 rounded-lg p-4 hover:bg-surface-sunken"
            >
              {/* Rule 3: a timestamp is data, printed as the server sent it —
                  never parsed, never re-rendered in a locale (§8). */}
              <span className="w-70 shrink-0 font-mono text-label leading-body whitespace-nowrap tabular-nums text-ink-muted">
                {event.at}
              </span>

              <span className="min-w-0 flex-1 leading-body text-ink-secondary">
                <span
                  className={
                    event.attend
                      ? "font-semibold text-state-attend"
                      : "font-semibold text-ink-primary"
                  }
                >
                  {event.label}
                </span>
                {event.attend && <span className="sr-only"> — needs attention</span>}
                {event.detail !== null && <span> · {event.detail}</span>}{" "}
                <span aria-hidden className="font-bold text-ink-secondary">
                  →
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
