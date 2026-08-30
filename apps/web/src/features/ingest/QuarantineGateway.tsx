import type { QuarantineState } from "@titlepipe/contract";
import { cx } from "../../components/ui";
import type { GatewayRow } from "./useQuarantineScan";

/**
 * THE QUARANTINE GATEWAY CHECKLIST, INLINE UNDER THE FILE ROW AS DRAWN.
 *
 * ⚠ RULED 2026-08-29 (`docs/frontend/design-2026-08/RULING-2026-08-29.md`):
 * the reference runs this on the intake form the moment a file lands, so it
 * renders HERE, fed by `useQuarantineScan` — the rows arrive with the SERVER's
 * per-step states and only the reveal cadence is local. The words are keyed
 * 1:1 to `QuarantineState` (design2.ts): nothing here advances a step, infers
 * "running" from the row above, or re-orders the list, and the typed Record
 * fails the build if the contract grows a fifth state.
 *
 * `sha` renders VERBATIM once the reveal completes — the digest is DATA
 * (`QuarantineResponse.sha256`), and the sentence beside it is the de-dup
 * step's own `detail`, quoted rather than composed.
 */
const STATE: Readonly<
  Record<QuarantineState, { mark: string; word: string; ink: string }>
> = {
  pending: { mark: "○", word: "queued", ink: "text-ink-faint" },
  running: { mark: "●", word: "checking…", ink: "text-action animate-tp-pulse" },
  passed: { mark: "✓", word: "clear", ink: "text-state-settled" },
  failed: { mark: "◆", word: "failed", ink: "text-state-halt" },
};

export function QuarantineGateway(props: {
  readonly rows: readonly GatewayRow[];
  /** The digest line, shown once every row is revealed. Null until then. */
  readonly sha: { readonly digest: string; readonly note: string | null } | null;
  readonly duplicateOf: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line-strong bg-surface-panel">
      <h2 className="border-b border-line-subtle bg-surface-sunken px-7 py-5 text-label font-bold leading-flat text-ink-faint">
        Quarantine Gateway
      </h2>

      <ol data-testid="quarantine-gateway" className="flex flex-col">
        {props.rows.map((row) => (
          <li
            key={row.id}
            data-testid="quarantine-step"
            data-state={row.state}
            className="flex items-center gap-5 border-b border-line-subtle px-7 py-5"
          >
            <span
              aria-hidden
              className={cx(
                "w-8 shrink-0 text-center font-mono text-meta font-bold leading-flat",
                STATE[row.state].ink,
              )}
            >
              {STATE[row.state].mark}
            </span>
            <span
              className={cx(
                "min-w-0 flex-1 font-sans text-meta leading-close",
                row.state === "pending"
                  ? "text-ink-faint"
                  : "font-semibold text-ink-primary",
              )}
            >
              {row.label}
            </span>
            {/* The state word, mono, as the reference sets it. */}
            <span
              className={cx(
                "shrink-0 font-mono text-label leading-flat",
                STATE[row.state].ink,
              )}
            >
              {STATE[row.state].word}
            </span>
            <span className="sr-only">{row.state}</span>
          </li>
        ))}
      </ol>

      {props.sha !== null && (
        <p
          data-testid="sha256"
          className="bg-state-settled-surface px-7 py-5 font-mono text-label leading-body break-all text-ink-muted"
        >
          sha256: {props.sha.digest}
          {props.sha.note !== null && ` · ${props.sha.note}`}
        </p>
      )}

      {props.duplicateOf !== null && (
        <p
          data-testid="quarantine-duplicate"
          className="bg-state-halt-surface px-7 py-5 font-sans text-label leading-body text-state-halt"
        >
          The server matched this digest to a prior intake:{" "}
          <span className="font-mono">{props.duplicateOf}</span>
        </p>
      )}
    </div>
  );
}
