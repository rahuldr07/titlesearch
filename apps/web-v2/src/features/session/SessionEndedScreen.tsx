import { Link } from "@tanstack/react-router";
import { Card } from "../../shared/ui/Card";
import { Stamp } from "../../shared/ui/Stamp";
import { buttonClasses } from "../../shared/ui/Button";
import { cn } from "../../shared/ui/classNames";

/**
 * Session expired. THE WHOLE SCREEN EXISTS TO ANSWER ONE QUESTION: did I lose
 * the order I was in the middle of?
 *
 * A reviewer who is timed out mid-order does not want a security explanation,
 * they want to know whether an hour of reading survived. So the reassurance is
 * SPECIFIC and it is CONCRETE — the order number, in mono, and where it went
 * back to — because "your work is saved" from a screen that just logged you out
 * is exactly the sentence nobody believes. Naming the order and naming the
 * queue tab is what makes it checkable.
 *
 * The stamp is ATTEND, not HALT. Nothing is broken and nothing needs fixing;
 * something needs attention. Reaching for the halt register here would put a
 * routine inactivity timeout in the same visual class as a package that failed
 * its completeness gate.
 *
 * `orderId` is a prop rather than a fetch: the session is gone, so there is no
 * authenticated call this screen could make. The caller — the thing that
 * detected the expiry — is the only party that still knows.
 */
export function SessionEndedScreen({ orderId = DEMO_HELD_ORDER }: { orderId?: string }) {
  return (
    <div className="flex min-h-full items-center justify-center py-20">
      <div className="w-full max-w-210 text-center">
        <div className="mb-11">
          <Stamp tone="attend" size="md">
            Session ended
          </Stamp>
        </div>

        <h1 className="mb-3 text-3xl font-semibold text-ink-primary">
          Your session expired
        </h1>
        <p className="mb-4 text-md leading-open text-ink-secondary">
          You were signed out after a period of inactivity. Nothing was lost.
        </p>

        <Card className="mb-10 flex items-center gap-6 px-8 py-7 text-left">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-state-settled-surface text-md text-state-settled-ink"
          >
            ✓
          </span>
          <p className="text-base leading-body text-ink-secondary">
            Order{" "}
            <span data-testid="held-order" className="font-mono font-semibold text-ink-primary">
              {orderId}
            </span>{" "}
            is saved exactly where you left it. It&rsquo;s back in{" "}
            <span className="font-semibold">Mine</span> on your queue.
          </p>
        </Card>

        <Link to="/" data-testid="session-handoff" className={cn(buttonClasses({ size: "xl" }))}>
          Sign in again
        </Link>
      </div>
    </div>
  );
}

/**
 * CONTRACT GAP: nothing on the wire tells a signed-out client which order the
 * expired session was holding — there is no `GET /api/me/session` and, by
 * design, nothing is kept in browser storage (§9.11). Until the server returns
 * the held order with the expiry, this is the design mock's own demo number and
 * it is not real data.
 */
const DEMO_HELD_ORDER = "4176034-1";
