import type { PipelineLogLine } from "@titlepipe/contract";
import { cx } from "../../components/ui";

/**
 * THE DARK RUN-LOG TERMINAL — ⚠ RULED 2026-08-29
 * (`docs/frontend/design-2026-08/RULING-2026-08-29.md` item 4: "the extraction
 * terminal log … they are drawn, so they are built"). This replaces the
 * `BackendGap` refusal that stood here: the ruling outranks the probe-visibility
 * reading for everything the reference draws, and the reference draws this
 * panel — header "Live telemetry" with a pulse dot, a `tail -f` prompt line,
 * one row per served `PipelineLogLine`, and a blinking cursor at the foot.
 *
 * EVERY LINE IS THE SERVER'S. `run_log` arrives on the pipeline response
 * (intake.ts, same ruling); nothing here streams, counts, or composes — the
 * WARN register and the bold line are the wire's own `warn` / `strong` flags.
 * The dark chrome is the rail family, which tokens.css assigns to "the
 * navigator, auth screens and code panels" — this is a code panel.
 */
export function TerminalLog(props: { readonly lines: readonly PipelineLogLine[] }) {
  return (
    <section
      data-testid="run-log-terminal"
      aria-label="Extraction run log"
      className="flex h-160 flex-col overflow-hidden rounded-lg bg-rail-deep"
    >
      <div className="flex items-center justify-between border-b border-rail-line bg-rail-surface px-6 py-5">
        <span className="font-sans text-label font-bold leading-flat text-rail-ink-soft">
          Live telemetry
        </span>
        <span
          aria-hidden
          className="size-4 animate-tp-pulse rounded-pill bg-state-settled-muted"
        />
      </div>

      <ol className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-8 font-mono text-label leading-body">
        <li aria-hidden className="text-rail-ink-muted">
          $ tail -f /var/log/titlepipe/ingest.log
        </li>
        {props.lines.map((line, index) => (
          <li
            // The log is append-only and served in order; position is identity.
            key={`${line.time}-${String(index)}`}
            data-warn={line.warn}
            className={cx(
              "flex gap-6",
              line.warn && "rounded-sm bg-state-halt/10 px-4 text-state-halt-muted",
            )}
          >
            <span
              className={cx(
                "shrink-0 tabular-nums",
                line.warn ? "text-state-halt-muted" : "text-rail-ink-muted",
              )}
            >
              {line.time}
            </span>
            <span
              className={cx(
                "min-w-0 break-words",
                line.warn
                  ? "text-state-halt-muted"
                  : line.strong
                    ? "font-bold text-state-settled-muted"
                    : "text-rail-ink",
              )}
            >
              {line.text}
            </span>
          </li>
        ))}
        {props.lines.length > 0 && (
          <li aria-hidden className="flex gap-6">
            <span className="animate-tp-pulse text-rail-ink-muted">_</span>
          </li>
        )}
      </ol>
    </section>
  );
}
