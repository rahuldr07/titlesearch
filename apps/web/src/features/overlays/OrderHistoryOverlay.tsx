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
        {/*
         * The design pairs a meta line with a "Launch Workstation" primary
         * here. The line is drawn; the button is not — this modal is what
         * opens for an order whose dataset never loaded, so a primary that
         * jumps into review is the one action it cannot promise. The row's
         * own Open → already offers it where it does hold.
         */}
        <FooterMeta orderId={orderId} />
        <Button onPress={() => close("order-history")}>Close</Button>
      </DialogFooter>
    </Dialog>
  );
}

/** The footer's left half: the server's page count, and nothing derived. */
function FooterMeta({ orderId }: { readonly orderId: string }) {
  const context = useRead(orderContext(orderId));
  const pages = context.data?.pages;
  if (pages === null || pages === undefined) return null;
  return (
    <span className="mr-auto self-center font-mono text-label leading-flat text-ink-faint">
      Order pages: {String(pages)} pp
    </span>
  );
}

function Body({ orderId }: { readonly orderId: string }) {
  const context = useRead(orderContext(orderId));
  const timeline = useRead(orderTimeline(orderId));
  const pages = context.data?.pages;

  return (
    <DialogBody>
      {/*
       * Identity, as the design heads this modal: the ref with its page
       * count, then the property and the client on one line. `place` and
       * `client` come off the order context — the same read the hub uses —
       * so nothing here is stitched together locally.
       */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-5">
          <span className="font-mono text-subject font-bold leading-flat text-ink-secondary">
            {context.data?.order_ref ?? orderId}
          </span>
          <span className="shrink-0 rounded-pill border border-line-strong bg-surface-sunken px-4 py-1 font-mono text-label leading-flat text-ink-muted">
            {pages === null || pages === undefined ? "Page count unread" : `${String(pages)} pp`}
          </span>
        </div>
        {context.data !== undefined && (
          <span className="text-meta font-semibold leading-close text-ink-primary">
            {context.data.place} · {context.data.client}
          </span>
        )}
      </div>

      {/* The design's kicker here reads "SOC 2 Compliance & Dual-Engine Audit
          Trail" — see the header comment for why only the second half of that
          claim survives. */}
      <span className="font-sans text-label font-semibold leading-flat text-ink-faint">
        Dual-engine audit trail
      </span>

      <QueryState query={timeline} of="this order's history">
        {(data) =>
          data.events.length === 0 ? (
            <Empty
              title="Nothing recorded yet"
              reason="The server holds no events for this order. Events are appended by the pipeline, never by this screen."
            />
          ) : (
            // 420px — the design's own scroll height for this trail.
            <ol className="flex max-h-210 flex-col gap-6 overflow-auto">
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

/**
 * One recorded event, boxed. The circled ordinal is the design's own device
 * for "this happened Nth" — it carries the accent border because the sequence
 * is the subject of this modal, and it is drawn, never counted: `n` is the
 * server's position in the list it sent.
 */
function Row(props: { readonly event: OrderTimelineEvent; readonly n: number }) {
  const { event, n } = props;
  return (
    <li
      data-event-kind={event.kind}
      data-event-attend={event.attend}
      className="flex items-center gap-6 rounded-lg border border-line-strong bg-surface-sunken p-6"
    >
      <span
        aria-hidden
        className="grid size-18 shrink-0 place-content-center rounded-pill border border-action-border bg-action-surface font-mono text-label font-bold leading-flat tabular-nums text-ink-secondary"
      >
        {String(n).padStart(2, "0")}
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
          <span className="shrink-0 font-mono text-label leading-flat tabular-nums text-ink-faint">
            {event.at}
          </span>
        </div>
        {event.detail !== null && (
          <span className="truncate text-label leading-close text-ink-muted">{event.detail}</span>
        )}
      </div>
    </li>
  );
}
