import type { OrderTimelineEvent } from "@titlepipe/contract";
import { useRouterState } from "@tanstack/react-router";
import { Button, Dialog, DialogBody, DialogFooter, Empty } from "../../components/ui";
import { QueryState } from "../../entities/state/QueryState";
import { useRead } from "../../app/useRead";
import { orderContext, orderTimeline } from "../../shared/queries";
import { useOverlayOpen, useOverlays } from "../../app/keyboard/overlays";

const ORDER_PATH = /^\/orders\/([^/]+)/;

/**
 * ORDER HISTORY — `GET /api/orders/{id}/timeline`, server-authored.
 *
 * The design subtitles this "SOC 2 Compliance & Dual-Engine Audit Trail". Not
 * transcribed: nothing in the contract backs a SOC 2 claim, and `endpoints.ts`
 * describes the shape as the order's thread through the pipeline, not an
 * attestable audit log. Naming it one would be this screen asserting a
 * certification on the server's behalf.
 *
 * ══ IT TAKES ITS SUBJECT FROM THE STORE FIRST, THE ROUTE SECOND ════════════
 *
 * `openOrderHistory(id)` names the order; `/orders/:id` is the fallback for the
 * order-scoped entry points that never named one. One surface, two ways of
 * being told — see `app/keyboard/overlays.ts`, which argues why a second
 * overlay for the All Orders table would have been two copies of this one.
 *
 * `attend` is the one flag the server owns here, and it renders as a DOT.
 * INVARIANT 66: never a count — a badge reading "3" is a number this screen
 * would have derived from a list length, which is the whole class of defect the
 * server-owns-state rule exists for.
 */
export function OrderHistoryOverlay() {
  const open = useOverlayOpen("order-history");
  const close = useOverlays((s) => s.close);
  const named = useOverlays((s) => s.historySubject);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const orderId = named ?? ORDER_PATH.exec(pathname)?.[1] ?? null;

  // Nobody named one and none in the URL: no history. It names its subject.
  // `isOpen` rather than an early return on `open`, so react-aria keeps the
  // exit animation — and `Body` (and its reads) mounts only while it is up.
  if (orderId === null) return null;

  return (
    <Dialog
      title="Order history"
      testId="order-history"
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) close("order-history");
      }}
    >
      <Body orderId={orderId} />
      <DialogFooter>
        <Button onPress={() => close("order-history")}>Close</Button>
      </DialogFooter>
    </Dialog>
  );
}

function Body({ orderId }: { readonly orderId: string }) {
  const context = useRead(orderContext(orderId));
  const timeline = useRead(orderTimeline(orderId));

  return (
    <DialogBody>
      <div className="flex items-baseline gap-6">
        <span className="font-mono text-subject font-semibold leading-flat text-ink-primary">
          {context.data?.order_ref ?? orderId}
        </span>
        <span className="font-mono text-label leading-flat text-ink-muted">
          {context.data?.pages === null || context.data?.pages === undefined
            ? "Page count unread"
            : `${String(context.data.pages)} pages`}
        </span>
      </div>

      <QueryState query={timeline} of="this order's history">
        {(data) =>
          data.events.length === 0 ? (
            <Empty
              title="Nothing recorded yet"
              reason="The server holds no events for this order. Events are appended by the pipeline, never by this screen."
            />
          ) : (
            // 420px — the design's own scroll height for this trail.
            <ol className="max-h-210 overflow-auto">
              {data.events.map((event, index) => (
                <Row
                  // `at` + `kind` is not unique — an order can be delivered
                  // twice. The index is the server's own ordering.
                  key={`${event.at}-${event.kind}-${String(index)}`}
                  event={event}
                  n={index + 1}
                />
              ))}
            </ol>
          )
        }
      </QueryState>
    </DialogBody>
  );
}

function Row(props: { readonly event: OrderTimelineEvent; readonly n: number }) {
  const { event, n } = props;
  return (
    <li
      data-event-kind={event.kind}
      data-event-attend={event.attend}
      className="flex items-start gap-6 border-b border-line-subtle py-6 last:border-b-0"
    >
      <span className="w-8 shrink-0 font-mono text-label leading-airy tabular-nums text-ink-muted">
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-6">
          <span className="flex items-center gap-3 text-meta font-semibold leading-close text-ink-primary">
            {event.attend && (
              <>
                <span aria-hidden className="font-mono text-label leading-flat text-state-attend">
                  ◆
                </span>
                <span className="sr-only">needs attention</span>
              </>
            )}
            {event.label}
          </span>
          {/* Rule 3: a timestamp is data — printed as the server sent it. */}
          <span className="shrink-0 font-mono text-label leading-flat tabular-nums text-ink-muted">
            {event.at}
          </span>
        </div>
        {event.detail !== null && (
          <span className="text-meta leading-body text-ink-secondary">{event.detail}</span>
        )}
      </div>
    </li>
  );
}
