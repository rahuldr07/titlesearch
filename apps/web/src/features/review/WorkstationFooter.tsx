import type { OrderCensus } from "@titlepipe/contract";

/**

 * THE WORKSTATION'S FOOTER BAR, measured off `reference-app.html`'s `isReview`:

 * flex-shrink:0 · white · border-top 1px #EDEFF3 · padding 16px space-between, wraps

 * left "✓ 128 cited fields verified · 6 fields pending confirmation" right…

 */
export function WorkstationFooter(props: { readonly census: OrderCensus | undefined }) {
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
       * The design's right half is a single disabled control. A full
       * `ContractGap` block here would dwarf the census beside it and turn a
       * footer into an essay — the gap is stated in one line, and the long form
       * lives in `CountersignPanel`, which blocks the same release.
       */}
      <p className="max-w-260 text-meta leading-close text-state-attend">
        Advance to publication is not built and not disabled: there is no compile
        endpoint, no gate shape and no{" "}
        <code className="font-mono text-label">release.execute</code>, so there is no
        control to disable.
      </p>
    </footer>
  );
}
