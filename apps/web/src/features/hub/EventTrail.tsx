import type { OrderTimelineEvent } from "@titlepipe/contract";
import { Card, CardBody, CardHeader, Empty } from "../../components/ui";

/**
 * THE EVENT TRAIL — design §Screens 4: "event trail (live: rulings,
 * countersign, QC, release, reissue append as they happen)."
 *
 * `OrderTimelineResponse` (`endpoints.ts:579`) is the contract surface: the
 * order's "thread through the pipeline (arrived, accepted, extracted, review
 * touches, escalations, delivery versions, complaints)", server-authored, with
 * the `kind` vocabulary deliberately left OPEN "until the FastAPI port owns
 * it."
 *
 * ══ `kind` IS OPEN, SO NOTHING SWITCHES ON IT ══════════════════════════════
 *
 * It is `z.string()` on purpose. A `Record<kind, glyph>` here would be this
 * screen deciding the vocabulary the backend has not settled, and an unlisted
 * kind would render as a hole. So the mark comes from `attend` — a boolean the
 * server DOES own — and `kind` is printed as the datum it is. AGENTS.md: do not
 * build past OPEN.
 *
 * ══ "LIVE" IS THE SERVER APPENDING, NOT THE CLIENT ═════════════════════════
 *
 * The design's "append as they happen" is, in the prototype, the browser
 * pushing a row onto a local array the moment a button is clicked. That is an
 * optimistic local mutation, and `INVARIANTS:39` is unambiguous: "The server's
 * returned state is what renders. NEVER an optimistic local mutation."
 * Mutations in this app return a bare `Ack` carrying no state back
 * (`endpoints.ts:30-34`) precisely so the client must re-read. The trail
 * therefore appends when the server says it has, which is on the refetch a
 * mutation triggers — one frame later, and true.
 *
 * ══ NO DURATIONS ═══════════════════════════════════════════════════════════
 *
 * `endpoints.ts:570`: the shape "never carries per-person pace data", and
 * `INVARIANTS:84-85` bans timers. So the trail prints `at` as the server sent
 * it and never computes an interval between two rows. Two timestamps and a
 * subtraction is a timer somebody wrote by hand.
 */
export function EventTrail(props: {
  readonly events: readonly OrderTimelineEvent[] | undefined;
}) {
  return (
    <Card padding="none">
      <CardHeader>Event trail</CardHeader>

      {props.events === undefined ? (
        <CardBody>
          <p className="text-meta leading-body text-ink-muted">
            The server has not sent this order's thread.
          </p>
        </CardBody>
      ) : props.events.length === 0 ? (
        <Empty
          title="Nothing recorded yet"
          reason="The server holds no events for this order. Events are appended by the pipeline, never by this screen."
        />
      ) : (
        <ol>
          {props.events.map((event, index) => (
            <li
              // `at` + `kind` is not unique — an order can be delivered twice
              // (v1 and v2, and `endpoints.ts:615-616` says the PAIR is the
              // defect record). The index is the row's position in the
              // server's own ordering, which is the only identity it has.
              key={`${event.at}-${event.kind}-${String(index)}`}
              data-event-kind={event.kind}
              data-event-attend={event.attend}
              className="flex items-baseline gap-6 border-b border-line-subtle px-12 py-7 last:border-b-0"
            >
              <span
                aria-hidden
                className={
                  event.attend
                    ? "w-6 shrink-0 font-mono text-body leading-flat text-state-attend"
                    : "w-6 shrink-0 font-mono text-body leading-flat text-state-settled-muted"
                }
              >
                {event.attend ? "◆" : "✓"}
              </span>
              {event.attend && <span className="sr-only">needs attention</span>}

              {/* Rule 3: a timestamp is data. Printed as the server sent it —
                  never parsed, never re-rendered in a locale (§8: a recording
                  date that moves by a day changes which lien is senior). */}
              <span className="w-56 shrink-0 font-mono text-label leading-flat tabular-nums text-ink-muted">
                {event.at}
              </span>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-meta font-semibold leading-close text-ink-primary">
                  {event.label}
                </span>
                {event.detail !== null && (
                  <span className="text-meta leading-body text-ink-secondary">
                    {event.detail}
                  </span>
                )}
              </div>

              <span className="shrink-0 font-mono text-label leading-flat text-ink-faint">
                {event.kind}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
