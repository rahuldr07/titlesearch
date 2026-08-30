import type { OrderCensus } from "@titlepipe/contract";
import { cx, Kbd, ProgressMeter, Switch } from "../../components/ui";

/**
 * THE WORKSTATION'S TOP BAR, measured off `reference-app.html`'s `isReview` —
 * and completed to the drawing under ⚠ RULING-2026-08-29
 * (`docs/frontend/design-2026-08/RULING-2026-08-29.md`): the bar now carries
 * the drawn meter with its mono "N/M VERIFIED" caption (both figures the
 * SERVER'S census — never a filter length), the drawn pill copy ("6 fields" /
 * "✓ Done"), and the drawn chord captions (C Confirm · E Edit · Q QC ·
 * J/K Nav · Z Zoom).
 *
 * SIX CHORDS, AND EVERY ONE IS INSTALLED. Rule 11: a screen may not advertise
 * a key it does not bind — `useReviewKeys.ts` installs all six, so the legend
 * and the bindings are one list (J and K share the drawn "J/K" chip).
 */
export function WorkstationBar(props: {
  readonly orderRef: string | null;
  /** `OrderCensus`. `undefined` members = the server did not say. */
  readonly census: OrderCensus | undefined;
  readonly openLabel: string | null;
  readonly flaggedFirst: boolean;
  readonly onFlaggedFirst: (on: boolean) => void;
}) {
  const settled = props.census?.settled;
  const decisions = props.census?.decisions;

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-8 border-b border-line-strong bg-surface-panel px-8 py-4">
      <div className="flex shrink-0 items-center gap-4">
        <h1 className="text-body font-bold leading-tight text-ink-primary">
          Examination Workstation
        </h1>
        {/* Rule 3: an order reference is an identifier. */}
        {props.orderRef !== null && (
          <span className="font-mono text-label leading-flat text-ink-muted">
            {props.orderRef}
          </span>
        )}
      </div>

      {/* The drawn meter: mono caption, then the dots — both server figures. */}
      {settled !== undefined && decisions !== undefined && (
        <div className="flex shrink-0 items-center gap-4">
          <span
            data-testid="verified-meter-label"
            className="font-mono text-label font-bold leading-flat tabular-nums text-ink-primary"
          >
            {settled}/{decisions} VERIFIED
          </span>
          <ProgressMeter label="Decisions settled" settled={settled} total={decisions} />
        </div>
      )}

      <p className="min-w-0 flex-1 truncate text-label leading-flat text-ink-muted">
        {props.openLabel === null ? (
          "No field open."
        ) : (
          <>
            Active Field{" "}
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
        Flagged first
      </Switch>

      <RemainingPill remaining={props.census?.remaining} />

      <div className="flex shrink-0 items-center gap-4 border-l border-line-strong pl-6">
        <Chip k="C" label="Confirm" />
        <Chip k="E" label="Edit" />
        <Chip k="Q" label="QC" />
        <Chip k="J/K" label="Nav" />
        <Chip k="Z" label="Zoom" />
      </div>
    </header>
  );
}

/**
 * WHAT THE SERVER IS STILL WAITING ON, in the drawn register: "6 fields", or
 * "✓ Done" once nothing is. Zero is a real answer; absent is the server
 * declining to say, and prints as that rather than as 0.
 */
function RemainingPill(props: { readonly remaining: number | undefined }) {
  const remaining = props.remaining;
  if (remaining === undefined) {
    return (
      <span
        data-testid="remaining-pill"
        className="shrink-0 rounded-pill bg-surface-sunken px-5 py-2 text-label leading-flat text-ink-muted"
      >
        No count sent
      </span>
    );
  }
  return (
    <span
      data-testid="remaining-pill"
      data-remaining={remaining}
      className={cx(
        "shrink-0 rounded-pill px-5 py-2 font-mono text-label leading-flat font-bold tabular-nums",
        remaining === 0
          ? "bg-state-settled-surface text-state-settled"
          : "bg-surface-sunken text-ink-secondary",
      )}
    >
      {remaining === 0
        ? "✓ Done"
        : `${remaining} ${remaining === 1 ? "field" : "fields"}`}
    </span>
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
