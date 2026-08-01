import { Link } from "@tanstack/react-router";
import { Card } from "../../shared/ui/Card";
import { Stamp } from "../../shared/ui/Stamp";
import { buttonClasses } from "../../shared/ui/Button";
import { Screen } from "../../shared/ui/Screen";
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
  // MEASURE 460, NOT THE EXPORT'S 420. The measure is the width of the CONTENT
  // (`Screen`), and the sheet below spends 28px a side on padding. Held at 420
  // the reassurance sentence broke one word onto its own line — the sheet would
  // have been paid for out of the copy.
  return (
    <Screen measure="460" pad="40" placement="centre">
      {/*
        THE SHEET IS THE SCREEN. RULE: `Screen`'s `centre` placement is the
        export's SIX SINGLE-CARD screens, and the reskin's ground is paper depth
        — every object in the product sits on a sheet above the desk. FAILURE
        PREVENTED: with the ground moved to the warm desk tone, a bare centred
        column has nothing under it, and the one screen a person meets when they
        have just been logged out is the one that reads half-built. It was the
        old near-white ground doing the work, not the layout.
      */}
      <Card size="emphasis" className="w-full px-14 py-15 text-center">
        <div className="mb-11">
          <Stamp tone="attend" size="md">
            Session ended
          </Stamp>
        </div>

        {/*
          THE DISPLAY FACE, AND NO `<em>`. RULE: every h1 in this app is Fraunces
          — the reskin moved the face onto `ScreenHeading` and this hand-rolled
          heading was left in the body face. FAILURE PREVENTED on the italic: the
          only phrase to emphasise here is "expired", and setting a routine
          inactivity timeout in the accent would give it the weight the halt
          register is reserved for. The reassurance below is the point of the
          screen; the heading is only the fact.
        */}
        <h1 className="mb-3 font-display font-title text-4xl leading-flat opsz-90 text-ink-primary">
          Your session expired
        </h1>
        <p className="mb-4 text-md leading-open text-ink-secondary">
          You were signed out after a period of inactivity. Nothing was lost.
        </p>

        {/* NESTED, AND TINTED SETTLED. An inner well never floats (`Card`), so
            the reassurance loses the shadow it wore as a free-standing card and
            takes the register its own ✓ was already drawn in. */}
        <Card
          size="nested"
          tone="settled"
          className="mb-10 flex items-center gap-6 px-8 py-7 text-left"
        >
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-panel text-md text-state-settled-ink"
          >
            ✓
          </span>
          <p className="text-base leading-body text-state-settled-ink">
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
      </Card>
    </Screen>
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
