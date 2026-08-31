import type { OpticalReading } from "@titlepipe/contract";
import { cx } from "../../components/ui";

/**
 * One row per `OpticalReading`, as the server sent them. Thresholds stay
 * server-owned: each reading carries the server's `ok` verdict beside its
 * `value`, and this card compares nothing against a floor — it does not know
 * one. A flagged reading renders the server's `note` verbatim, never a
 * sentence composed here.
 */
export function OpticalProfile(props: {
  readonly optical: readonly OpticalReading[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line-strong bg-surface-panel">
      <h2 className="border-b border-line-subtle bg-surface-sunken px-7 py-5 text-label font-bold leading-flat text-ink-faint">
        Optical Profile — read from the file
      </h2>

      <ul data-testid="optical-profile" className="flex flex-col">
        {props.optical.map((reading) => (
          <li
            key={reading.id}
            data-testid="optical-reading"
            data-ok={reading.ok ? "true" : "false"}
            className="flex items-baseline gap-5 border-b border-line-subtle px-7 py-5"
          >
            {/* A reading below the floor is a warning the pipeline degrades
                around, not a halt. */}
            <span
              aria-hidden
              className={cx(
                "w-8 shrink-0 text-center font-mono text-meta leading-flat",
                reading.ok ? "text-state-settled" : "text-state-attend",
              )}
            >
              {reading.ok ? "✓" : "◆"}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="font-sans text-meta font-semibold leading-close text-ink-primary">
                {reading.label}
              </span>
              {reading.note !== null && (
                <span className="font-sans text-label leading-close text-ink-muted">
                  {reading.note}
                </span>
              )}
              {/* The verdict word, for a reader who cannot see the mark. */}
              <span className="sr-only">
                {reading.ok ? "within the floor" : "flagged by the server"}
              </span>
            </span>
            <span className="shrink-0 font-mono text-label leading-flat text-ink-secondary">
              {reading.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
