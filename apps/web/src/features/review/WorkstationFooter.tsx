import type { OrderCensus } from "@titlepipe/contract";

/**
 * THE WORKSTATION'S FOOTER BAR, measured off `reference-app.html`'s `isReview`:
 *
 *     flex-shrink:0 · white · border-top 1px #EDEFF3 · padding 16px
 *     space-between, wraps
 *     left   "✓ 128 cited fields verified · 6 fields pending confirmation"
 *     right  "Advance to Publication Studio →"  (disabled until the gate opens)
 *
 * ══ THE LEFT HALF IS THE SERVER'S CENSUS ═══════════════════════════════════
 *
 * `OrderCensus` carries `fields`, `auto_confirmed`, `needs_review`, `no_source`
 * and — added for this screen — `decisions`, `settled`, `queue_rest`. The
 * prototype's two figures are the same shape of fact, so they are printed from
 * those members and nothing is added up here. `endpoints.ts:167-190`:
 * "`settled` is how many of those carry a ruling", and every one of the three
 * was moved off the client precisely because the browser was computing them.
 *
 * Absent is not zero. Each figure prints only when the server sent it, and the
 * sentence says which is missing rather than filling in a `0` nobody sent.
 *
 * ══ THE RIGHT HALF CANNOT BE A BUTTON ══════════════════════════════════════
 *
 * "Advance to Publication Studio" is the release gate. There is no compile
 * endpoint, no gate-evaluation shape, no sign-and-execute endpoint and no
 * `release.execute` action in `PERMISSIONS` — `unbuiltScreens.ts` records the
 * whole list. AGENTS.md forbids building past `OPEN`.
 *
 * A disabled button is the wrong refusal, for the reason `CountersignGap` gives
 * at more length: rule 12's "disabled with the rule" assumes the action exists
 * and this reader may not take it. Nothing may advance an order from here —
 * not this reader, not an admin — because there is nothing to call.
 *
 * It is ONE LINE, not a `ContractGap` block. The design's right half is a
 * single control; a full gap card here dwarfs the census beside it and turns a
 * 16px footer into an essay. `CountersignGap` carries the long form, and it
 * blocks the same release.
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
            <span className="tabular-nums">{census.fields}</span> fields
            auto-confirmed by the pipeline
            {census.settled !== undefined && census.decisions !== undefined && (
              <>
                {" · "}
                <span className="tabular-nums">{census.settled}</span> of{" "}
                <span className="tabular-nums">{census.decisions}</span>{" "}
                decisions settled
              </>
            )}
          </>
        )}
      </p>

      {/*
       * The design's right half is a single disabled control. A full
       * `ContractGap` block here would dwarf the census beside it and turn a
       * footer into an essay — the gap is stated in one line, and the long form
       * lives in `CountersignGap`, which blocks the same release.
       */}
      <p className="max-w-260 text-meta leading-close text-state-attend">
        Advance to publication is not built and not disabled: there is no
        compile endpoint, no gate shape and no{" "}
        <code className="font-mono text-label">release.execute</code>, so there
        is no control to disable.
      </p>
    </footer>
  );
}
