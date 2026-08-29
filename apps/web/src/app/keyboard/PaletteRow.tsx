import type { PaletteEntry } from "./commands";
import { cx } from "../../components/ui";

/**
 * ONE PALETTE ROW — label, the design's second line, and the type tag.
 *
 * NO ICON TILE. The design draws a 32px glyph tile per row: `⌘` for a screen,
 * `#` for an order, `⚡` for an action. Rule 7 closes the glyph vocabulary at
 * `✓ ◆ • T1` and bans emoji and icon soup outright, and the tag on the right
 * already names the type — a tile would be a second encoding of one fact, in
 * characters the rulebook does not stock. Refused, not overlooked.
 *
 * The selected row takes the tinted surface AND the filled tag, as the design
 * does: `it.rowStyle` and `it.tagStyle` both flip on `sel`. Selection is never
 * colour alone.
 */
export function PaletteRow(props: {
  readonly entry: PaletteEntry;
  readonly isSelected: boolean;
}) {
  const { entry, isSelected } = props;
  return (
    <button
      type="button"
      onClick={entry.run}
      data-selected={isSelected ? "1" : "0"}
      className={cx(
        "tp-state flex w-full items-center justify-between gap-6 rounded-sm px-8 py-4 text-left",
        isSelected ? "bg-action-surface" : "hover:bg-surface-sunken",
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span
          className={cx(
            "truncate text-meta leading-close",
            isSelected ? "font-semibold text-action" : "text-ink-primary",
          )}
        >
          {entry.label}
        </span>
        {entry.hint !== "" && (
          <span className="truncate text-label leading-close text-ink-muted">
            {entry.hint}
          </span>
        )}
      </span>
      <span
        className={cx(
          "shrink-0 rounded-pill px-4 py-1 text-label font-semibold leading-flat",
          isSelected
            ? "bg-action text-surface-panel"
            : "bg-surface-sunken text-ink-muted",
        )}
      >
        {entry.group}
      </span>
    </button>
  );
}

/**
 * THE FOOTER LEGEND. The design prints "↑↓ Navigate · ↵ Select · Esc Dismiss"
 * beside a brand name; the brand name is fixture branding and is dropped, and
 * the legend is kept because it is the only place the arrow and Enter keys are
 * advertised — they are pane-local to this input and so are deliberately NOT in
 * `keymap.ts`, which is the global registry.
 */
export function PaletteLegend() {
  return (
    <p className="flex gap-8 border-t border-line-subtle bg-control-fill px-12 py-6 font-mono text-label leading-flat text-ink-muted">
      <span>↑↓ Move</span>
      <span>↵ Open</span>
      <span>Esc Close</span>
    </p>
  );
}
