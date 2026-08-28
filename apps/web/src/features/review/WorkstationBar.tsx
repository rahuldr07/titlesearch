import { Kbd, Switch } from "../../components/ui";

/**
 * THE WORKSTATION'S TOP BAR, measured off `reference-app.html`'s `isReview`:
 * 8px 16px on white, 1px underneath, gap 16, wrapping — h1 "Examination
 * Workstation" 16px w700 (16, not 28: this is a toolbar), the order ref in
 * mono, the active field, the flagged-first toggle and the chord legend.
 *
 * SIX CHORDS, AND EVERY ONE IS INSTALLED. Rule 11: a screen may not advertise
 * a key it does not bind. `Z` was missing from this legend and C/E/Q/J/K were
 * printed with nothing behind them; `useReviewKeys.ts` now installs all six,
 * so the legend and the bindings are one list.
 *
 * NO MEASURE, NO PILL. The design draws a per-decision dot strip and an "N
 * fields" pill beside it. The strip is `DecisionDock`'s (it holds the server's
 * `settled`/`decisions`); the pill is `decisions - settled`, and that is count
 * arithmetic in the browser — `OrderCensus` carries no `remaining`, so it is
 * not printed. CONTRACT GAP: `OrderCensus.remaining: z.number().int().optional()`.
 */
export function WorkstationBar(props: {
  readonly orderRef: string | null;
  readonly openLabel: string | null;
  readonly flaggedFirst: boolean;
  readonly onFlaggedFirst: (on: boolean) => void;
}) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-8 border-b border-line-strong bg-surface-panel px-8 py-4">
      <div className="flex shrink-0 items-center gap-4">
        <h1 className="text-body font-bold leading-tight text-ink-primary">
          Examination workstation
        </h1>
        {/* Rule 3: an order reference is an identifier. */}
        {props.orderRef !== null && (
          <span className="font-mono text-label leading-flat text-ink-muted">
            {props.orderRef}
          </span>
        )}
      </div>

      <p className="min-w-0 flex-1 truncate text-label leading-flat text-ink-muted">
        {props.openLabel === null ? (
          "No field open."
        ) : (
          <>
            Active field{" "}
            <span className="font-semibold text-ink-primary">{props.openLabel}</span>
          </>
        )}
      </p>

      {/* A VIEW ORDER OVER THE SECTIONS, and it re-ranks nothing: it reads the
          `flagged` boolean each section already carries from the server's own
          queue membership. No count, no score, no threshold. */}
      <Switch
        data-testid="flagged-first"
        isSelected={props.flaggedFirst}
        onChange={props.onFlaggedFirst}
      >
        Flagged sections first
      </Switch>

      <div className="flex shrink-0 items-center gap-4 border-l border-line-strong pl-6">
        <Chip k="C" label="Confirm" />
        <Chip k="E" label="Correct" />
        <Chip k="Q" label="Escalate" />
        <Chip k="J" label="Next" />
        <Chip k="K" label="Previous" />
        <Chip k="Z" label="Zoom" />
      </div>
    </header>
  );
}

/** One hotkey chip. `Kbd` carries the key's own register (rule 3: kbd is mono). */
function Chip(props: { readonly k: string; readonly label: string }) {
  return (
    <span className="flex items-center gap-2 rounded-pill border border-line-strong bg-surface-sunken px-4 py-1 text-label leading-flat text-ink-secondary">
      <Kbd>{props.k}</Kbd>
      {props.label}
    </span>
  );
}
