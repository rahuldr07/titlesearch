import { useOverlays } from "../keyboard/overlays";
import { Kbd } from "../../components/ui";

/**

 * THE BRAND BLOCK and THE SEARCH BOX — the top of the design's rail. Rule 7: a FLAT

 * brand mark, no gradient, and the design's own note says it is "typed 'TF' in a flat

 * square" — never an asset.

 */
export function RailBrand(props: { readonly connected: boolean }) {
  return (
    <>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-ink-primary text-meta font-bold leading-flat text-surface-panel">
            TF
          </span>
          <span className="truncate text-subject font-bold leading-flat tracking-tight text-surface-panel">
            TitlePipe
          </span>
        </div>
        <span className="truncate text-label leading-flat text-rail-ink-muted">
          Title abstract engine
        </span>
      </div>
      <span
        data-testid="rail-status"
        role="img"
        title={
          props.connected
            ? "Connected — your permissions loaded"
            : "Not connected — permissions have not loaded, so no door is drawn"
        }
        aria-label={props.connected ? "Connected" : "Not connected"}
        className={
          props.connected
            ? "size-4 shrink-0 rounded-pill bg-state-settled"
            : "size-4 shrink-0 rounded-pill bg-state-halt"
        }
      />
    </>
  );
}

/**

 * THE SEARCH BOX — a BUTTON, not an input, and the design agrees: the reference markup

 * is `<button on-click="openPalette">` with placeholder text and a ⌘K cap. It looks

 * like a field because what it opens IS a search surface.

 */
export function RailSearch() {
  const toggle = useOverlays((s) => s.toggle);
  return (
    <div className="px-6 pt-6">
      <button
        type="button"
        data-testid="rail-search"
        onClick={() => toggle("palette")}
        className="tp-state tp-press flex h-19 w-full items-center gap-4 rounded-lg border border-rail-line bg-rail-line px-6 text-meta leading-flat text-rail-ink-muted hover:text-rail-ink"
      >
        <SearchGlyph />
        <span className="min-w-0 flex-1 truncate text-left">Quick jump…</span>
        {/* `rounded-lg` overrides `Kbd`'s own `--radius-xs`: a key cap is normally
            the innermost object in rule 5's ladder, but this one sits INSIDE a
            14px field and the design draws it at the field's radius, not a
            step below it. Still a token, still on the six-radius scale. */}
        <Kbd className="shrink-0 rounded-lg border-transparent bg-rail-line text-rail-ink">
          ⌘K
        </Kbd>
      </button>
    </div>
  );
}

/**

 * The one glyph in the rail. Rule 7 bans "icon soup", and the design's rail draws

 * per-door icons that are deleted with the door rows — a word plus a picture of the

 * same word is the soup.

 */
function SearchGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
