import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { PassOrderResponse, type Order } from "@titlepipe/contract";
import { get, post } from "../../shared/api";
import { queueNext } from "../../shared/queries";
import { notify } from "../../shared/notify";
import { useChords } from "../../shared/chords";
import { Button, Card, Empty, Kbd } from "../../components/ui";
import { ServedOrder } from "./ServedOrder";
import { PassReason } from "./PassReason";

/**
 * SCREEN — THE QUEUE, AT `/queue` (`authz.ts:63`, reviewer + admin).
 *
 * ══ THIS IS NOT THE DESIGN'S SCREEN 3, AND THAT IS DELIBERATE ══════════════
 *
 * The design draws "All Orders" here: a searchable, filterable, paginated table
 * with Ref / Address / Client / Stage / ASSIGNED / DUE columns, an SLA chip and
 * a per-row `Open →`. Every one of those affordances is refused, and the
 * refusal is not a preference:
 *
 *   - `INVARIANTS:82-83` — the queue is a SINGLE SERVER-CHOSEN NEXT ORDER, no
 *     list, no browsing, no cherry-picking.
 *   - `INVARIANTS:84-85` — no pace indicators, no timers, and no time
 *     ESTIMATES; an estimate is a pace indicator. That deletes Due and the SLA
 *     chip outright.
 *   - `endpoints.ts:69` — "there is no browse/pick endpoint", and `:77-82`
 *     records that `/api/queue/bands` carries "no claim token, no assignment
 *     field, no ordering the caller can influence" precisely so that no
 *     cherry-picking holds BY CONSTRUCTION rather than by this screen's
 *     restraint.
 *
 * `INVARIANTS:26-27` says what to do about that: a rule a design cannot satisfy
 * is a CONFLICT IN THE DESIGN, stop and report, do not weaken the rule. It is
 * reported in `docs/frontend/design-2026-08/CONFLICT-all-orders.md` and awaits
 * an owner ruling. What is built here is the queue THE CONTRACT SUPPORTS,
 * wearing the design's visual language: one card, the accent spent once, the
 * design's type and spacing.
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
  const client = useQueryClient();
  const [passing, setPassing] = useState(false);

  const served = useQuery({
    queryKey: queueNext.key,
    queryFn: () => get(queueNext.path, queueNext.schema),
  });

  const order: Order | null = served.data?.order ?? null;

  /**
   * A REASONED PASS RECORDS, AND THE SERVER SERVES THE NEXT ORDER
   * (`INVARIANTS:87`). The response is a bare `{ ok: true }` — pass counts and
   * the 4th-pass auto-escalation stay server-side (`endpoints.ts:206-210`) —
   * so there is nothing to read out of it. Advancing is a REFETCH of
   * `/api/queue/next`, not a local step through a list: this screen does not
   * hold a list to step through, and the server may well serve something other
   * than "the next row".
   */
  const pass = useMutation({
    mutationFn: (reason: string) =>
      post(`/api/orders/${order?.id ?? ""}/pass`, PassOrderResponse, { reason }),
    onSuccess: async () => {
      const passed = order?.external_ref ?? "";
      setPassing(false);
      await client.invalidateQueries({ queryKey: queueNext.key });
      // The record of the act, in the reviewer's own frame: which order left.
      notify.success(`Recorded — passed ${passed}`);
    },
    // The server's message, VERBATIM (`INVARIANTS:58-59`). A 403 from the role
    // gate and a 422 from the schema both arrive here and both keep the order.
    onError: (error: Error) => notify.error(error.message),
  });

  const startReview = useCallback(() => {
    if (order === null) return;
    void navigate({ to: "/orders/$orderId", params: { orderId: order.id } });
  }, [navigate, order]);

  const bindings = useMemo(
    () => ({
      /** `INVARIANTS:88` — Enter starts review on the SERVED order. */
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
      <header className="flex flex-col gap-2">
        <span className="text-label font-semibold uppercase leading-flat tracking-caps text-ink-faint">
          Queue
        </span>
        <h1 className="text-title font-bold leading-tight text-ink-primary">
          Next for you
        </h1>
        {/*
         * THE SCREEN SAYS WHAT IT IS. Not decoration: a reviewer who expects a
         * list and is handed one order should be told that is the design,
         * rather than left assuming the list failed to load.
         */}
        <p className="max-w-240 text-meta leading-body text-ink-secondary">
          The server chooses. There is one order at a time and no way to pick a
          different one — pass with a reason and the next is served.
        </p>
      </header>

      {served.isPending && (
        <Card>
          <p className="text-meta leading-body text-ink-muted">Asking the queue…</p>
        </Card>
      )}

      {served.isError && (
        <Card>
          <p
            data-testid="queue-error"
            role="alert"
            className="text-meta leading-body text-state-halt"
          >
            {served.error.message}
          </p>
        </Card>
      )}

      {served.isSuccess && order === null && (
        <Card padding="none">
          {/*
           * NULL IS AN ANSWER, NOT AN EMPTY LIST. `QueueNextResponse.order` is
           * nullable and the server saying "nothing" is a statement about the
           * queue, not a filter that matched nothing — so there is no Clear
           * search here, because there was never a search.
           */}
          <Empty
            title="Nothing queued for you"
            reason="The server has no next order for this seat. There is no list to look through — when work is ready it is served here."
          />
        </Card>
      )}

      {order !== null && (
        <Card padding="none">
          <ServedOrder order={order} />
          <div className="flex flex-col gap-6 border-t border-line-subtle px-12 py-10">
            {passing ? (
              <PassReason
                pending={pass.isPending}
                onSubmit={(reason) => pass.mutate(reason)}
                onCancel={() => setPassing(false)}
              />
            ) : (
              <div className="flex items-center gap-6">
                {/* Rule 1: the accent is spent ONCE, here. */}
                <Button variant="primary" onPress={startReview}>
                  Start review <Kbd muted>Enter</Kbd>
                </Button>
                <Button variant="ghost" onPress={() => setPassing(true)}>
                  Pass <Kbd muted>P</Kbd>
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
