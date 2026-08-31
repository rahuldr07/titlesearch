import { useOverlays } from "../keyboard/overlays";
import { Kbd } from "../../components/ui";

/**
 * The brand block and the search box — the top of the rail. The brand mark
 * is flat, typed text in a square — never an asset.
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
        <span className="truncate text-label leading-flat text-rail-ink-soft">
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
 * The search box — a button, not an input. It looks like a field because
 * what it opens is a search surface.
 */
export function RailSearch() {
  const toggle = useOverlays((s) => s.toggle);
  return (
    <div className="px-6 pt-6">
      <button
        type="button"
        data-testid="rail-search"
        onClick={() => toggle("palette")}
        className="tp-state tp-press flex h-18 w-full items-center gap-4 rounded-lg border border-rail-edge bg-rail-fill px-6 text-meta leading-flat text-rail-ink-soft hover:text-rail-ink"
      >
        <SearchGlyph />
        <span className="min-w-0 flex-1 truncate text-left">Quick jump…</span>
        {/* `rounded-lg` overrides `Kbd`'s own radius: this cap sits inside a
            field and is drawn at the field's radius. Still a token. */}
        <Kbd className="shrink-0 rounded-lg border-transparent bg-rail-cap text-surface-panel">
          ⌘K
        </Kbd>
      </button>
    </div>
  );
}

/** The search glyph. */
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
