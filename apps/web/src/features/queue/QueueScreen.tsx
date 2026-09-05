import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import type { Order } from "@titlepipe/contract";
import { get } from "../../shared/api";
import { queueNext } from "../../shared/queries";
import { useChords } from "../../shared/chords";
import { ServedOrderCard } from "./ServedOrderCard";
import { usePassOrder } from "./usePassOrder";
import {
  QueueAsking,
  QueueEmpty,
  QueueFailed,
  QueueHeader,
  PassedNote,
} from "./QueueStates";

/**
 * SCREEN — THE QUEUE, AT `/queue` (`authz.ts:63`, reviewer + admin).
 *
 * ══ THIS IS NOT THE DESIGN'S SCREEN 3, AND THAT IS DELIBERATE ══════════════
 *
 * The design draws "All Orders" here: a searchable, filterable, paginated table
 * with Ref / Address / Client / Stage / ASSIGNED / DUE columns, an SLA chip and
 * a per-row `Open →`. Every one of those is refused —
 * `app/chrome/builtScreens.ts` carries the citations at the point the door is
 * registered, and `docs/frontend/design-2026-08/CONFLICT-all-orders.md` is the
 * report `INVARIANTS:26-27` requires. Unresolved, awaiting an owner ruling.
 *
 * What is built here is the queue THE CONTRACT SUPPORTS, wearing the design's
 * visual language: one card, the accent spent once, the design's type and
 * spacing.
 *
 * ══ THE KEYS ARE PANE-LOCAL ════════════════════════════════════════════════
 *
 * `INVARIANTS:104-106` and `queue-keys.spec`: the innermost layer that can use
 * a key wins, and A FOCUSED CONTROL OWNS THE KEYSTROKE. `useChords` runs that
 * test inside the handler on every stroke (`shared/chords.ts`), so Enter on a
 * rail door follows the link, Enter on the pass button opens the reason, and
 * Enter with nothing focused takes the served order. The previous
 * implementation bound Enter to the document with `preventDefault: true` and no
 * scope, so a keyboard-only reviewer could not follow a single rail link and
 * every attempt ASSIGNED THEM AN ORDER. Taking an order is a work-assignment
 * act, not navigation.
 */
export function QueueScreen() {
  const navigate = useNavigate();
  const [passing, setPassing] = useState(false);
  /**
   * The ref of the order this reviewer last passed, for the on-screen record.
   * Held here rather than read back from the server because the server does not
   * return it — `PassOrderResponse` is `{ ok: true }` and nothing else
   * (`endpoints.ts:212-216`), deliberately. This is not server STATE being
   * mirrored; it is a note about what this person just did, which is the one
   * kind of thing the client legitimately knows.
   */
  const [passedRef, setPassedRef] = useState<string | null>(null);

  const served = useQuery({
    queryKey: queueNext.key,
    queryFn: () => get(queueNext.path, queueNext.schema),
  });

  const order: Order | null = served.data?.order ?? null;

  const pass = usePassOrder(
    order === null ? null : { id: order.id, ref: order.external_ref },
  );

  const startReview = useCallback(() => {
    if (order === null) return;
    /*
     * `INVARIANTS:88` — Enter STARTS REVIEW on the served order, and review is
     * `/orders/{id}/review`, not the hub. Taking an order means going to work
     * on it; landing on a summary would be Enter opening a description of the
     * thing it said it was starting.
     *
     * Typed navigation, so a misspelled path or param is a COMPILE error
     * rather than a runtime not-found — which is the whole reason the
     * order-scoped routes are declared by hand in `app/routeTree.tsx`.
     */
    void navigate({
      to: "/orders/$orderId/review",
      params: { orderId: order.id },
    });
  }, [navigate, order]);

  const bindings = useMemo(
    () => ({
      Enter: (event: KeyboardEvent) => {
        if (order === null || passing) return;
        event.preventDefault();
        startReview();
      },
      p: (event: KeyboardEvent) => {
        if (order === null) return;
        event.preventDefault();
        setPassing(true);
      },
    }),
    [order, passing, startReview],
  );

  useChords(bindings, { enabled: true });

  return (
    <div className="tp-screen-enter flex h-full min-h-0 flex-col gap-10 overflow-y-auto p-14">
      <QueueHeader />

      {served.isPending && <QueueAsking />}

      {served.isError && <QueueFailed message={served.error.message} />}

      {served.isSuccess && order === null && <QueueEmpty />}

      {passedRef !== null && <PassedNote orderRef={passedRef} />}

      {order !== null && (
        <ServedOrderCard
          order={order}
          passing={passing}
          passPending={pass.isPending}
          onStartReview={startReview}
          onOpenPass={() => setPassing(true)}
          onCancelPass={() => setPassing(false)}
          onSubmitPass={(reason) =>
            pass.mutate(reason, {
              onSuccess: () => {
                setPassedRef(order.external_ref);
                setPassing(false);
              },
            })
          }
        />
      )}
    </div>
  );
}
