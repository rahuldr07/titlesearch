import type { TemplateSheetBlock } from "@titlepipe/contract";
import { cx } from "../../components/ui";
import { NA_MODES, interpolate } from "./useTemplates";
import type { NaSimMode } from "./TemplatesScreen";

/**
 * One live-sheet block, split from `TemplateSheet.tsx` on the 150-line gate.
 * Clickable (selects the block for the inspector); the NA simulation swaps
 * the interpolated wording for the SERVED declaration of the simulated
 * absence (RULED 2026-08-29).
 */
export function SheetBlock({
  block,
  selected,
  naMode,
  wording,
  onPick,
}: {
  readonly block: TemplateSheetBlock;
  readonly selected: boolean;
  readonly naMode: NaSimMode;
  readonly wording: string;
  readonly onPick: () => void;
}) {
  const naLabel = NA_MODES.find((mode) => mode.id === naMode)?.label ?? "";
  const naText =
    naMode !== "normal" && block.na_matrix !== null ? block.na_matrix[naMode] : null;
  const simulated = naText !== null;

  return (
    <button
      type="button"
      data-testid={`sheet-block-${block.key}`}
      aria-pressed={selected}
      onClick={onPick}
      className={cx(
        "tp-state flex w-full cursor-pointer flex-col gap-4 rounded-lg border p-6 text-left",
        selected ? "border-action bg-surface-panel" : "border-transparent hover:bg-surface-panel",
      )}
    >
      <span className="flex items-center justify-between gap-4">
        <span className="font-sans text-label leading-flat font-bold tracking-caps uppercase text-ink-muted">{/* rules-allow: the sheet's block caps are drawn uppercase (RULING-2026-08-29) */}
          {block.title}
        </span>
        <span className="shrink-0 rounded-pill bg-action-surface px-4 py-1 font-sans text-label leading-flat font-semibold text-ink-secondary">
          {block.lock_note}
        </span>
      </span>

      {simulated ? (
        <span
          data-testid={`sheet-na-${block.key}`}
          className="rounded-md border border-state-attend-border bg-state-attend-surface p-5 font-mono text-label leading-body text-state-attend"
        >
          <span className="block font-bold tracking-caps uppercase">{naLabel}</span>{/* rules-allow: the NA declaration's cap is drawn uppercase (RULING-2026-08-29) */}
          {naText}
        </span>
      ) : (
        block.wording !== "" && (
          <span className="rounded-md border border-line-subtle bg-surface-sunken p-5 font-sans text-label leading-body text-ink-primary">
            <span className="block pb-1 font-medium text-ink-secondary">
              Client template interpolated wording:
            </span>
            {interpolate(wording, block.tokens)}
          </span>
        )
      )}

      <span className="grid grid-cols-[minmax(0,1fr)_minmax(0,2.5fr)] gap-x-8 gap-y-2">
        {block.rows.map((row) => (
          <SheetRow key={row.label} label={row.label} value={row.value} mono={row.mono} />
        ))}
      </span>

      {block.overlay_note !== null && (
        <span className="rounded-md border border-line-strong bg-surface-sunken px-4 py-2 font-sans text-label leading-close text-ink-secondary">
          <span className="font-bold">State overlay:</span> {block.overlay_note}
        </span>
      )}
    </button>
  );
}

function SheetRow({
  label,
  value,
  mono,
}: {
  readonly label: string;
  readonly value: string;
  readonly mono: boolean;
}) {
  return (
    <>
      <span className="font-sans text-label leading-close font-medium text-ink-muted">
        {label}
      </span>
      <span
        className={cx(
          "text-label leading-body text-ink-primary",
          mono ? "font-mono" : "font-sans",
        )}
      >
        {value}
      </span>
    </>
  );
}
