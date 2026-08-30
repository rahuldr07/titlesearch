import type { NaReason } from "@titlepipe/contract";
import { cx } from "../../components/ui";

/**
 * LAW 3 — DECLARING WHICH ABSENCE THIS IS, AND THERE ARE FOUR OF THEM.
 *
 * ⚠ RULED 2026-08-29 (`docs/frontend/design-2026-08/RULING-2026-08-29.md`):
 * the reference draws this as a 2×2 GRID of the four absence options under the
 * heading "Law 3 Protocol: Declare Null Provenance" — a bold label over a
 * small body on each cell — not as a select. Rebuilt as the drawn grid, with
 * the drawn copy; the four still map one-to-one onto the contract's ratified
 * `NaReason` members (`enums.ts:20-52`) and still never collapse.
 *
 * NOT GATED ON `value === null`. The reference shows this grid INSTEAD of
 * confirm/edit for a field its fixture flags `NA_ONLY`. Nothing on the wire
 * carries that flag, and `enums.ts:44-48` forbids the obvious substitute:
 * "never key anything off `value === null`". So the declaration is a fourth
 * act available on every open decision, and the reviewer decides.
 */
const ABSENCE_OPTIONS: readonly {
  readonly reason: NaReason;
  readonly label: string;
  readonly body: string;
}[] = [
  {
    reason: "NOT_PRESENT",
    label: "Structurally absent",
    body: "Legal concept does not exist for this instrument (e.g. GA security deed trustee)",
  },
  {
    reason: "NOT_FOUND",
    label: "Not found in package",
    body: "Search index was examined and instrument was omitted by client/searcher",
  },
  {
    reason: "NOT_STATED",
    label: "Not stated in instrument",
    body: "Instrument is physically present but leaves clause or amount blank",
  },
  {
    reason: "PRESENT_UNREADABLE",
    label: "Unreadable / degraded",
    body: "Document scan contrast is below optical resolution threshold",
  },
];

export function AbsencePicker(props: {
  readonly reason: NaReason | null;
  readonly onPick: (reason: NaReason) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-meta font-semibold leading-close text-ink-primary">
        Law 3 Protocol: Declare Null Provenance
      </p>

      <div data-testid="na-state-grid" className="grid grid-cols-2 gap-4">
        {ABSENCE_OPTIONS.map((option) => {
          const picked = option.reason === props.reason;
          return (
            <button
              key={option.reason}
              type="button"
              data-testid={`na-option-${option.reason}`}
              aria-pressed={picked}
              onClick={() => props.onPick(option.reason)}
              className={cx(
                "tp-state flex cursor-pointer flex-col items-start gap-1 rounded-lg border p-6 text-left",
                picked
                  ? "border-action bg-action-surface"
                  : "border-line-strong bg-surface-panel hover:border-action-border",
              )}
            >
              <span className="text-meta font-bold leading-close text-ink-secondary">
                {option.label}
              </span>
              <span className="text-label leading-body font-normal text-ink-muted">
                {option.body}
              </span>
            </button>
          );
        })}
      </div>

      {/* The four route differently downstream — say so at the point of choice. */}
      <p
        data-testid="na-state-sentence"
        className="text-meta leading-body text-ink-secondary"
      >
        {props.reason === null
          ? "Four absences, and they are not interchangeable. Choose the one the document supports."
          : (ABSENCE_OPTIONS.find((option) => option.reason === props.reason)?.body ??
            "")}
      </p>
    </div>
  );
}
