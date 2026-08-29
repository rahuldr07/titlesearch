import type { QuarantineResponse, QuarantineState } from "@titlepipe/contract";
import { cx } from "../../components/ui";

/**
 * THE QUARANTINE GATEWAY CHECKLIST — README §22's "AV → real-PDF → SHA-256
 * de-dup, sequential with pulsing dot". One row per `QuarantineStep`
 * (design2.ts:14-20), in the order the server sent them.
 *
 * THERE IS NO CLIENT STATE MACHINE. `state` arrives decided (`QuarantineState`,
 * design2.ts:11 — exactly four members) and nothing here advances a step,
 * infers "running" from the row above, or re-orders the list. The design's
 * "queued / checking… / clear" are PRESENTATION WORDS keyed 1:1 to the server's
 * states — the same shape as `StageTimeline`'s `PHASE` map — and the typed
 * Record fails the build if the contract grows a fifth state.
 *
 * `sha256` renders VERBATIM, cited to `QuarantineResponse.sha256`
 * (design2.ts:37). The digest used to arrive only inside a duplicate's 409
 * prose; since the 2026-08-28 ruling it is data. A duplicate still refuses at
 * upload with the server's 409 sentence (INVARIANT 48, `RefusedCard`/banner) —
 * `duplicate_of` below is the same fact as data, shown only when the server
 * sent one.
 *
 * Rule 7's glyph vocabulary: ✓ done, • running/waiting, ◆ halted. No fourth
 * mark, and the pulse is the token file's own `tp-pulse`.
 */
const STATE: Readonly<
  Record<QuarantineState, { mark: string; word: string; ink: string }>
> = {
  pending: { mark: "•", word: "queued", ink: "text-ink-faint" },
  running: { mark: "•", word: "checking…", ink: "text-action animate-tp-pulse" },
  passed: { mark: "✓", word: "clear", ink: "text-state-settled" },
  failed: { mark: "◆", word: "failed", ink: "text-state-halt" },
};

export function QuarantineGateway(props: { readonly data: QuarantineResponse }) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-label font-semibold leading-flat text-ink-faint">
        Quarantine gateway
      </h2>

      <ol data-testid="quarantine-gateway" className="flex flex-col">
        {props.data.steps.map((step) => (
          <li
            key={step.id}
            data-testid="quarantine-step"
            data-state={step.state}
            className="flex items-baseline gap-6 border-b border-line-subtle py-5"
          >
            <span
              aria-hidden
              className={cx(
                "w-8 shrink-0 text-center font-mono text-meta leading-flat",
                STATE[step.state].ink,
              )}
            >
              {STATE[step.state].mark}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="font-sans text-meta font-semibold leading-close text-ink-primary">
                {step.label}
              </span>
              {/* The server's sentence about the step, verbatim. */}
              {step.detail !== null && (
                <span className="font-sans text-label leading-close text-ink-muted">
                  {step.detail}
                </span>
              )}
              {/* The state word, for a reader who cannot see the mark. */}
              <span className="sr-only">{step.state}</span>
            </span>
            <span
              className={cx(
                "shrink-0 font-mono text-label leading-flat",
                STATE[step.state].ink,
              )}
            >
              {STATE[step.state].word}
            </span>
          </li>
        ))}
      </ol>

      <p
        data-testid="sha256"
        className="font-mono text-label leading-body break-all text-ink-muted"
      >
        sha256 {props.data.sha256}
      </p>

      {props.data.duplicate_of !== null && (
        <p
          data-testid="quarantine-duplicate"
          className="font-sans text-meta leading-body text-state-halt"
        >
          The server matched this digest to a prior intake:{" "}
          <span className="font-mono">{props.data.duplicate_of}</span>
        </p>
      )}
    </div>
  );
}
