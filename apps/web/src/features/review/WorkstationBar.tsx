import { Kbd } from "../../components/ui";
import type { OrderCensus } from "@titlepipe/contract";

/**

 * THE WORKSTATION'S TOP BAR, measured off `reference-app.html`'s `isReview`: 8px 16px

 * on white, 1px #E4E7ED underneath, gap 16, wraps h1 "Examination Workstation" 16px

 * w700 ← 16, not 28: this is a toolbar reviewSub 11px mono #6E7480…

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
            <span className="font-semibold text-ink-primary">{props.openLabel}</span>
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
