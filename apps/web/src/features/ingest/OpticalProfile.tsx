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
    <div className="flex flex-col gap-6">
      <h2 className="text-label font-semibold leading-flat text-ink-faint">
        Optical profile
      </h2>

      <ul data-testid="optical-profile" className="flex flex-col">
        {props.optical.map((reading) => (
          <li
            key={reading.id}
            data-testid="optical-reading"
            data-ok={reading.ok ? "true" : "false"}
            className="flex items-baseline gap-6 border-b border-line-subtle py-5"
          >
            <span
              aria-hidden
              className={cx(
                "w-8 shrink-0 text-center font-mono text-meta leading-flat",
                reading.ok ? "text-state-settled" : "text-state-halt",
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
