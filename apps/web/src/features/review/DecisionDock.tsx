import type { OrderCensus } from "@titlepipe/contract";

/**
 * What is left of this order's queue. The meter that used to stand here was
 * the verdict card's: the reference names the two captions separately —
 * `answeredMeterLabel` ("12/18 VERIFIED", the review screen) and
 * `verdictBadge` ("12 of 18 decisions settled", the hub) — and this screen
 * was drawing both, one under the other, off the same two server numbers.
 * The bar keeps the meter; `queue_rest` is the only figure here the bar does
 * not already carry. Every number is the server's.
 */
export type DecisionDockProps = {
  readonly census: OrderCensus | undefined;
};

export function DecisionDock({ census }: DecisionDockProps) {
  const rest = census?.queue_rest;

  return (
    <section
      data-testid="decision-dock"
      className="flex flex-col gap-6 border-b border-line-strong px-10 py-8"
    >
      {rest === undefined ? (
        /* The silence, printed. Not a zero, not a spinner pretending to be
           one — the server did not send a census and this says so. */
        <p className="font-sans text-meta leading-close text-ink-faint">
          The server sent no decision census for this order.
        </p>
      ) : (
        <p className="font-sans text-meta leading-close text-ink-secondary">
          Rest of the queue ·{" "}
          <span className="font-mono tabular-nums text-ink-primary">{rest}</span>
        </p>
      )}
    </section>
  );
}
