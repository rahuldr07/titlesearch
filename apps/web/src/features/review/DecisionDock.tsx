import type { OrderCensus } from "@titlepipe/contract";
import { ProgressMeter } from "../../components/ui";

/**
 * THE DECISION DOCK — "N of M answered", and every number is the SERVER'S.
 *
 * ══ THE ARITHMETIC THAT IS NOT HERE ════════════════════════════════════════
 *
 * `endpoints.ts` carries a block comment above `OrderCensus` saying why these
 * three figures had to move onto the wire: the browser was computing
 * `settled` as a filter over `fields[].state`, `decisions` as `settled +
 * queued`, and the rest of the queue as a subtraction. That is the reference
 * prototype's `derived()` — `answeredTotal = D.base + answeredNow` — which
 * ANALYSIS-behavior §5 quotes and then rules on: "NONE of `derived()` may
 * survive into the React build as authority."
 *
 * So there is no `+` and no `-` in this file. Three fields are read and three
 * numbers are printed.
 *
 * ══ ABSENT IS NOT ZERO ═════════════════════════════════════════════════════
 *
 * `census` is optional on the wire and the three decision figures are optional
 * within it, "and absent is not zero — it is 'the server did not say'. The
 * strip must PRINT THE SILENCE rather than fill it in, which is the whole point
 * of moving these numbers off the client." A `?? 0` here would be the
 * derivation coming back in its cheapest form: a zero nobody sent, rendered as
 * a fact.
 *
 * ══ AND IT IS A CENSUS, NEVER A RATE ═══════════════════════════════════════
 *
 * INVARIANT 26: "no approve-all, no throughput, no timers. Anywhere." There is
 * no elapsed time on this dock, no per-hour figure, no estimate of what is
 * left in minutes, and §4.5 means there never may be. `ProgressMeter` is dots
 * rather than a percentage bar for the same reason — its own header argues
 * that a bar "invites 'how fast is the bar moving'".
 */
export type DecisionDockProps = {
  readonly census: OrderCensus | undefined;
};

export function DecisionDock({ census }: DecisionDockProps) {
  const settled = census?.settled;
  const decisions = census?.decisions;
  const rest = census?.queue_rest;

  return (
    <section
      data-testid="decision-dock"
      className="flex flex-col gap-6 border-b border-line-strong px-10 py-8"
    >
      {settled === undefined || decisions === undefined ? (
        /* THE SILENCE, PRINTED. Not a zero, not a spinner pretending to be
           one — the server did not send a census and this says so. */
        <p className="font-sans text-meta leading-close text-ink-faint">
          The server sent no decision census for this order.
        </p>
      ) : (
        <>
          <ProgressMeter label="Decisions" settled={settled} total={decisions} />
          {rest !== undefined && (
            <p className="font-sans text-meta leading-close text-ink-secondary">
              Rest of the queue ·{" "}
              <span className="font-mono tabular-nums text-ink-primary">{rest}</span>
            </p>
          )}
        </>
      )}
    </section>
  );
}
