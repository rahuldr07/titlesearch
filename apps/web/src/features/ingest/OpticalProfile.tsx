import type { OpticalReading } from "@titlepipe/contract";
import { cx } from "../../components/ui";

/**
 * THE OPTICAL PROFILE CARD — README §22's "DPI, clerk stamp located, contrast
 * floor". One row per `OpticalReading` (design2.ts:26-32), as the server sent
 * them.
 *
 * THRESHOLDS STAY SERVER-OWNED, and the shape says so where it is defined
 * (design2.ts:22-25): each reading carries the server's `ok` VERDICT beside
 * its `value`, and this card compares nothing against a floor — it does not
 * know one. A reading the server flagged renders the server's `note` verbatim
 * under it (the mock's contrast row: "p7, p22, p29 — flagged under Law 3"),
 * never a sentence composed here.
 */
export function OpticalProfile(props: {
  readonly optical: readonly OpticalReading[];
}) {
  return (
    /* Boxed like the gateway card above it — the drawn frame
       (RULING-2026-08-29): header strip, one bordered row per reading. */
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
            {/* ◆ in the ATTEND tone, as the reference inks its flagged row:
                a reading below the floor is a warning the pipeline degrades
                around (Law 3), not a halt. */}
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
