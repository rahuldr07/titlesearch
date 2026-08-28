import { Kbd } from "../../components/ui";
import type { OrderCensus } from "@titlepipe/contract";

/**
 * THE WORKSTATION'S TOP BAR, measured off `reference-app.html`'s `isReview`:
 *
 *     8px 16px on white, 1px #E4E7ED underneath, gap 16, wraps
 *     h1 "Examination Workstation" 16px w700   ← 16, not 28: this is a toolbar
 *     reviewSub 11px mono #6E7480
 *     answered meter + dot row + "Active Field: <label>"
 *     right: Flagged first · Law 3 NA Guide · remaining pill · hotkey chips
 *
 * The h1 is `text-body` because the prototype sets it at 16px. A workstation
 * bar is not a screen header with a subhead under it — the subject of the
 * screen is the decision in the middle pane, and a 28px title above it would
 * take the first read away from the thing being decided.
 *
 * ══ THE METER IS THE SERVER'S CENSUS ═══════════════════════════════════════
 *
 * `DecisionDock` already draws it from `OrderCensus.settled` / `.decisions` /
 * `.queue_rest`, three members `endpoints.ts:167-190` added FOR THIS SCREEN
 * because "every one of those three numbers was being computed in the browser".
 * The prototype's dot row is that census; it is not redrawn here.
 *
 * ══ WHAT IS NOT DRAWN, AND WHY ═════════════════════════════════════════════
 *
 * - **"Flagged first"** — a view toggle over the server's field order.
 *   `fieldNaming.sectionsOf` deliberately does not sort, "because re-ordering
 *   it by state or by name would be the browser deciding what a reviewer meets
 *   first", and it leaves the choice to the screen. The toggle is legitimate
 *   and is NOT built yet: it needs a home for the preference, and §9.11 forbids
 *   `localStorage` while `Preferences` (intake.ts:375) carries no member for
 *   it. Adding one is a contract change, so the toggle waits rather than
 *   arriving as a setting that evaporates on reload.
 * - **"Law 3 NA Guide"** — a modal explaining the four-state NA taxonomy.
 *   `entities/field/NaStateGrid` already renders exactly that grid, so this is
 *   a wiring job rather than a gap; it is left out of this pass so the bar
 *   ships without a button that opens nothing.
 *
 * The hotkey chips are the prototype's five, and they name chords the screen
 * actually installs (`shared/chords.ts`). A chip for a key that does nothing is
 * worse than no chip — INVARIANT 53 makes the same point about the key map.
 */
export function WorkstationBar(props: {
  readonly orderRef: string | null;
  readonly census: OrderCensus | undefined;
  readonly openLabel: string | null;
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
            <span className="font-semibold text-ink-primary">
              {props.openLabel}
            </span>
          </>
        )}
      </p>

      <div className="flex shrink-0 items-center gap-4 border-l border-line-strong pl-6">
        <Chip k="C" label="Confirm" />
        <Chip k="E" label="Edit" />
        <Chip k="Q" label="Escalate" />
        <Chip k="J" label="Next" />
        <Chip k="K" label="Previous" />
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
