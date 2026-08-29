import type { OrderCensus } from "@titlepipe/contract";
import { RouteButton } from "../../app/chrome/RouteButton";

/**

 * THE WORKSTATION'S FOOTER BAR, measured off `reference-app.html`'s `isReview`:

 * flex-shrink:0 · white · border-top 1px #EDEFF3 · padding 16px space-between, wraps

 * left "✓ 128 cited fields verified · 6 fields pending confirmation" right…

 */
export function WorkstationFooter(props: {
  readonly orderId: string;
  readonly census: OrderCensus | undefined;
}) {
  const census = props.census;

  return (
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-8 border-t border-line-subtle bg-surface-panel px-8 py-8">
      <p className="text-meta leading-close text-ink-secondary">
        {census === undefined ? (
          "The server sent no census for this order."
        ) : (
          <>
            <span aria-hidden className="text-state-settled">
              ✓
            </span>{" "}
            <span className="tabular-nums">{census.auto_confirmed}</span> of{" "}
            <span className="tabular-nums">{census.fields}</span> fields auto-confirmed
            by the pipeline
            {census.settled !== undefined && census.decisions !== undefined && (
              <>
                {" · "}
                <span className="tabular-nums">{census.settled}</span> of{" "}
                <span className="tabular-nums">{census.decisions}</span> decisions
                settled
              </>
            )}
          </>
        )}
      </p>

      {/*
       * The design's right half is "Advance to publication", and it is REAL
       * now: the compiler lives at `/orders/{id}/release` (`ReleaseScreen`),
       * with `release.compile`/`release.execute` in PERMISSIONS. The same link
       * the hub's `VerdictCard` draws, so the two doors cannot drift. Not
       * gated here: the release gates (0 open fields, T1 countersign, no
       * uncovered gaps) are the SERVER's, enforced at compile/execute and
       * surfaced verbatim on that screen — a client-side pre-check would be
       * the browser re-deriving a state machine it does not own.
       */}
      <RouteButton
        variant="secondary"
        to="/orders/$orderId/release"
        params={{ orderId: props.orderId }}
        data-testid="footer-release"
      >
        Advance to publication →
      </RouteButton>
    </footer>
  );
}
