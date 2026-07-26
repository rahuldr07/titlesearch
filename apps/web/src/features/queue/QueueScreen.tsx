import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  PassOrderRequest,
  PassOrderResponse,
  QueueNextResponse,
} from "@titlepipe/contract";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../api";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { RequiredComment } from "../../shared/ui/RequiredComment";
import { ScreenFrame } from "../../shared/ui/ScreenFrame";
import {
  EmptyState,
  InertPending,
  Loading,
  Unavailable,
} from "../../shared/ui/states";
import { isTypingTarget } from "../review/keys";

/**
 * Queue — the front door. One order, handed over.
 *
 * The whole screen is `GET /api/queue/next`: the server picks, the reviewer
 * takes. There is no browse endpoint, no list, no filter, no "skip to that
 * one" — asking for a *different* order is not an affordance that exists
 * (§0.4 anti-cherry-pick). The design states the rule to the user in its own
 * copy and both lines are kept verbatim: "Work comes to you" and "the system
 * decides — no picking".
 *
 * PASSING IS THE ONLY WAY OUT, AND IT COSTS A REASON (orphan rule O1). What the
 * pass then triggers is not this screen's business: it does not count passes,
 * does not know the 4th-pass threshold, and never learns whether the order was
 * escalated. The response is a bare ack by design.
 *
 * NO PACE, ANYWHERE (§0.4). No orders-per-shift, no time estimate, no "you are
 * behind". The one clock on this screen belongs to the ORDER — turnaround is a
 * stated success metric (CONTEXT §4) and an order that has been waiting is a
 * fact about the order, not a score for the reviewer. The design says it best
 * and the lede keeps it: "Every clock here belongs to an order, never to you."
 *
 * CONTRACT GAP: the design's Next-up card also shows a product chip, a page
 * count, a "read in full" count, and the wait as a DURATION ("Waiting 3h 12m").
 * `Order` carries none of those — no product, no page counts, and no
 * `waiting_for`/`waited_ms`. The counts and the product are therefore absent
 * rather than guessed, and the clock renders the server's own `arrived_at`
 * instead of a duration this screen would have to compute against the
 * browser's clock. Add `waited` (server-computed) + page counts to `Order` or a
 * queue-item projection and the card fills in with no layout change.
 *
 * RULING Q12 (open): the design draws Queue as a workspace — Next up plus
 * Mine, Held, In flight and Recently delivered. Next up is built for real; the
 * other four ship INERT (one block, named as one question, because it is one
 * question) because the contract has exactly one queue endpoint and inventing
 * four lists means inventing four endpoints.
 */

/** The order's own clock, formatted. Never a duration this screen computes. */
const ARRIVED = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function QueueScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [passing, setPassing] = useState(false);
  /**
   * The ref of the order this reviewer just passed, kept only to say so. It is
   * a receipt for an action, not queue state — nothing reads it back, and it
   * dies with the screen (constraint 11: nothing in browser storage).
   */
  const [passedRef, setPassedRef] = useState<string | null>(null);

  const next = useQuery({
    queryKey: ["queue", "next"],
    queryFn: () => api(QueueNextResponse, "/api/queue/next"),
  });

  const pass = useMutation({
    mutationFn: async (v: { orderId: string; reason: string }) =>
      api(PassOrderResponse, `/api/orders/${v.orderId}/pass`, {
        method: "POST",
        body: JSON.stringify(PassOrderRequest.parse({ reason: v.reason })),
      }),
  });

  const order = next.data?.order ?? null;
  const orderId = order?.id ?? null;

  const take = useCallback(
    (id: string) => {
      void navigate({
        to: "/orders/$orderId/review",
        params: { orderId: id },
        search: {},
      });
    },
    [navigate],
  );

  /**
   * Keyboard-first (§3, ruling Q3): ⏎ takes the served order, P passes it.
   * Declared above the loading/error branches so the hook is unconditional —
   * the handler reads `orderId` and no-ops until the server has served one.
   *
   * Escape is handled BEFORE the typing guard: it is the way out of the pass
   * input, which is itself a typing target. Every other key defers to O15 —
   * a reason containing "p", or the Enter that submits it, must never be read
   * as a command.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        setPassing(false);
        return;
      }
      if (isTypingTarget(e.target)) return; // O15
      if (orderId === null) return;
      if (e.key === "Enter") {
        // While the pass form is open, ⏎ belongs to the form (its submit
        // button can hold focus) — never to "start reviewing this order".
        if (passing) return;
        e.preventDefault();
        take(orderId);
        return;
      }
      if (e.key.toLowerCase() === "p") {
        e.preventDefault();
        setPassing(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [orderId, passing, take]);

  const submitPass = (reason: string) => {
    if (order === null) return;
    const ref = order.external_ref;
    pass.mutate(
      { orderId: order.id, reason },
      {
        onSuccess: () => {
          setPassing(false);
          setPassedRef(ref);
          // The server re-picks. This screen does not advance a cursor of its
          // own — it asks again and renders whatever comes back.
          void qc.invalidateQueries({ queryKey: ["queue", "next"] });
        },
      },
    );
  };

  return (
    <ScreenFrame
      eyebrow="Your queue"
      title="Work comes to you"
      lede="The system hands over the next order by age and priority — there's no list to shop through. Every clock here belongs to an order, never to you."
    >
      {passedRef === null ? null : (
        <div
          data-testid="passed-note"
          className="mb-5 rounded-lg border border-state-settled-border bg-state-settled-surface px-4 py-3 text-sm leading-relaxed text-ink-secondary"
        >
          <span className="font-semibold text-state-settled-ink">
            You passed <span className="font-mono">{passedRef}</span>
          </span>{" "}
          — your reason is on that order's record. What happens to it next is the
          server's call, not this screen's.
        </div>
      )}

      <div className="mx-0.5 mb-2 flex flex-wrap items-baseline gap-2">
        <div className="text-xs font-bold tracking-eyebrow text-page-ref uppercase">
          Next up
        </div>
        <div className="text-sm text-ink-muted">
          the system decides — no picking
        </div>
      </div>

      {next.isPending ? (
        <Loading what="your queue" />
      ) : next.isError ? (
        <Unavailable
          what="The queue"
          detail={next.error.message}
          testId="queue-unavailable"
        />
      ) : order === null ? (
        <EmptyState
          testId="queue-empty"
          title="Nothing assigned, nothing waiting on you."
          detail="That's the good outcome — the next order is handed over when one arrives. You are not scored for the gap."
        />
      ) : (
        <Card testId="next-up" edge="decide">
          <CardHeader>Next order in line</CardHeader>
          <CardBody>
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-[240px] flex-1">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span
                    data-testid="order-ref"
                    className="font-mono text-xl font-semibold text-ink-primary"
                  >
                    {order.external_ref}
                  </span>
                  <span className="text-sm text-ink-secondary">
                    {order.county} · {order.state}
                  </span>
                  {/* the server's own status word, rendered verbatim — this
                      screen derives no status and maps none (constraint 9) */}
                  <Chip tone="neutral">{order.status}</Chip>
                </div>
                <div className="mt-2 flex flex-wrap items-baseline gap-2">
                  <span className="text-micro font-bold tracking-badge text-ink-muted uppercase">
                    Waiting since
                  </span>
                  <time
                    dateTime={order.arrived_at}
                    className="font-mono text-md font-semibold text-ink-primary"
                  >
                    {ARRIVED.format(new Date(order.arrived_at))}
                  </time>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="take-next"
                  onClick={() => take(order.id)}
                  className="rounded-md border border-page-ref bg-page-ref px-5 py-3 text-lg font-semibold text-ink-on-action"
                >
                  Take next order →
                </button>
                <button
                  type="button"
                  data-testid="act-pass"
                  onClick={() => setPassing((p) => !p)}
                  className="rounded-md border border-line-strong bg-surface-panel px-3 py-1.5 text-sm font-semibold text-ink-secondary"
                >
                  Pass — say why
                </button>
              </div>
            </div>

            {passing ? (
              <div className="mt-4 max-w-[440px] border-t border-line-subtle pt-3">
                <RequiredComment
                  label="Why are you passing? — required"
                  placeholder="why are you passing this order?"
                  nudge="Nothing is recorded without it — a pass needs its why to be worth reading."
                  submitLabel="Pass this order"
                  testId="pass-reason"
                  submitTestId="pass-submit"
                  autoFocus
                  disabled={pass.isPending}
                  onSubmit={submitPass}
                />
                <div className="mt-2 text-tiny leading-relaxed text-ink-muted">
                  Recorded against the order. Repeated passes are escalated by
                  the server — this screen neither counts them nor knows the
                  threshold. Escape keeps the order.
                </div>
                {pass.isError ? (
                  <div
                    data-testid="pass-failed"
                    className="mt-2 rounded-md border border-state-halt-border bg-state-halt-surface px-2 py-1.5 text-sm text-state-halt-ink"
                  >
                    {pass.error.message}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-3 text-tiny leading-relaxed text-ink-muted">
              <span className="font-mono font-semibold text-ink-secondary">
                ⏎
              </span>{" "}
              takes it ·{" "}
              <span className="font-mono font-semibold text-ink-secondary">
                P
              </span>{" "}
              passes it, with a reason. This is the only order on the screen, and
              there is no way to ask for a different one.
            </div>
          </CardBody>
        </Card>
      )}

      {/*
        TODO(ruling) Q12 — is the queue a single card or a workspace? Until it
        resolves, the four other drawn sections are named and inert. Nothing
        below invents an order, a count, or an endpoint.
      */}
      <div className="mt-6">
        <InertPending what="The queue-as-workspace board" ruling="Q12">
          <div className="text-sm leading-relaxed text-ink-secondary">
            The design draws four more sections beside Next up:{" "}
            <span className="font-semibold text-ink-primary">Mine</span> (in
            progress, Resume),{" "}
            <span className="font-semibold text-ink-primary">Held</span>{" "}
            (stopped, waiting on someone),{" "}
            <span className="font-semibold text-ink-primary">In flight</span>{" "}
            (senior · ops), and{" "}
            <span className="font-semibold text-ink-primary">
              Recently delivered
            </span>{" "}
            (Reopen · v2). None is rendered with data:{" "}
            <span className="font-mono">GET /api/queue/next</span> is the only
            queue endpoint the contract defines and it serves one order. Q12 also
            has to settle what the anti-cherry-pick rule now means — "you cannot
            choose your next order" or "you cannot see other orders."
          </div>
        </InertPending>
      </div>
    </ScreenFrame>
  );
}
