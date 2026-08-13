import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

/**
 * THE CONTROL THAT FOLDS THE NAVIGATOR, and the one thing on the column that is
 * not navigation.
 *
 * Split out of `Sidebar` on 2026-08-13 for the reason `RailSection` was before
 * it: the column had grown a third job (the width and fold, the brand row, and
 * now a two-state control with its own argument) and the third was accreting
 * inside the header row where a component hides until it is too tangled to move.
 *
 * AND IT RECEDES. The mockup has no such control — it draws one state — but the
 * fold is a product feature (`sidebar.spec`: Review opens collapsed, `[` toggles
 * it, the choice persists server-side), so it stays and instead stops looking
 * like one of the doors. It was a bordered box, which in a rail whose marks are
 * borderless was the only chrome-drawn rectangle on the column and read as the
 * most important thing on it.
 *
 * ONE CONTROL, ONE FAMILY. It drew the characters `[` and `]` — the chord that
 * works it — which read as a mnemonic beside nine geometric door marks and as
 * debris beside anything else, and which made folding and unfolding look like
 * two different buttons. Both states are now the same pair pointing opposite
 * ways. THE CHORD IS NOT LOST WITH THE BRACKET: it is taught in the `?` map,
 * which is where every other chord in this app is learned, and `aria-label`
 * names the action in words in both states.
 *
 * The icons are `lucide-react`, already a dependency and already the app's icon
 * set — deliberately NOT the door catalogue's Unicode pictographs, since looking
 * unlike a door is this control's whole brief.
 */
export interface RailFoldProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function RailFold({ collapsed, onToggle }: RailFoldProps) {
  return (
    <button
      type="button"
      data-testid="rail-toggle"
      aria-pressed={collapsed}
      aria-label={collapsed ? "Expand the navigator" : "Fold the navigator"}
      onClick={onToggle}
      // Rail tokens, not app ink: `--color-ink-muted` measures 1.70:1 on this
      // column. See `tokens.css`, "the navigator's own ink family".
      className="shrink-0 rounded-3 p-1 text-rail-ink-muted hover:bg-rail-row-hover hover:text-rail-ink"
    >
      {collapsed ? (
        <PanelLeftOpen aria-hidden className="size-8" />
      ) : (
        <PanelLeftClose aria-hidden className="size-8" />
      )}
    </button>
  );
}
