import { cx } from "../../components/ui";
import { NA_MODES } from "./useTemplates";
import type { NaSimMode } from "./TemplatesScreen";

/**
 * The NA simulation bar — Data present · the four numbered absence modes.
 * Pure view state: it chooses which served declaration the sheet previews
 * and computes nothing.
 */
export function NaSimBar({
  naMode,
  onNaMode,
}: {
  readonly naMode: NaSimMode;
  readonly onNaMode: (mode: NaSimMode) => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line-subtle bg-surface-sunken px-8 py-3">
      <span className="font-sans text-label leading-flat font-bold text-ink-secondary">
        Simulation
      </span>
      {[{ id: "normal" as const, label: "Data present" }, ...NA_MODES].map((mode) => (
        <button
          key={mode.id}
          type="button"
          data-testid={`na-sim-${mode.id}`}
          aria-pressed={naMode === mode.id}
          onClick={() => onNaMode(mode.id)}
          className={cx(
            "tp-state cursor-pointer rounded-pill border px-4 py-1 font-sans text-label leading-flat",
            naMode === mode.id
              ? "border-action bg-action font-bold text-ink-on-action"
              : "border-line-strong bg-surface-panel font-medium text-ink-muted hover:bg-row-hover",
          )}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
