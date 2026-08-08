import { Card } from "../../shared/ui/Card";

/**
 * NOTHING ASSIGNED, NOTHING WAITING — said out loud, once, above the bands.
 *
 * RULE: an empty queue is a RESULT, not a blank page. FAILURE PREVENTED: with
 * Mine and Held both at zero the screen drew four dashed "nothing here" panels
 * in a column and nothing else, which reads as a fetch that came back wrong.
 * The export draws this card instead and names the outcome — "that's the good
 * outcome" — so the one arrangement a reviewer most wants to trust is the one
 * the screen states plainly.
 *
 * RULE: the condition is the SERVER'S CENSUS, never `orders.length`. FAILURE
 * PREVENTED: the row list is scoped to what the caller may open and the census
 * is not, so a reviewer who simply cannot see the held work would be told
 * nothing is waiting on anyone. The screen passes the two counts; this card
 * decides nothing.
 *
 * NO CONTROL ON IT. "Take the next order when you're ready" points at the Next
 * up card below rather than repeating its button — a second Take here would be
 * two doors onto one hand-over, and the hand-over is the server's.
 *
 * The disc is DECORATION and is hidden from the accessible name: the sentence
 * beside it is the whole message, and a screen reader announcing a bare check
 * mark first would put a verdict in front of it.
 */
export function QuietState() {
  return (
    <Card className="flex items-center gap-7 p-11">
      <span
        aria-hidden="true"
        className="flex size-13 shrink-0 items-center justify-center rounded-pill bg-state-settled-surface text-lg text-state-settled-ink"
      >
        ✓
      </span>
      <p className="text-md leading-body text-ink-secondary">
        <span className="font-semibold text-ink-primary">
          Nothing assigned, nothing waiting on you.
        </span>{" "}
        That&rsquo;s the good outcome — take the next order when you&rsquo;re ready.
      </p>
    </Card>
  );
}
