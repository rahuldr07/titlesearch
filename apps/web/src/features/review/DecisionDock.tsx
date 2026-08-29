import type { OrderCensus } from "@titlepipe/contract";
import { ProgressMeter } from "../../components/ui";

/**

 * THE DECISION DOCK — "N of M decisions settled", printed beside the dots as
 * the reference draws it, and every number is the SERVER'S.

 * `endpoints.ts` carries a block comment above `OrderCensus` saying why these three

 * figures had to move onto the wire: the browser was computing `settled` as a…

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
          <div data-testid="decisions-settled" data-settled={settled}>
            {/* The caption is VISIBLE, not aria-only: the reference prints the
                pair beside its meter, and it is the same server pair the
                footer prints — one variable, never two literals (rule 11). */}
            <ProgressMeter
              label="Decisions"
              settled={settled}
              total={decisions}
              caption={`${settled} of ${decisions} decisions settled`}
            />
          </div>
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
