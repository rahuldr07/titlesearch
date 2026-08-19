import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * Page position and zoom, above the page.
 *
 * The position reads `p3 / 64` — the page you are on, over the WHOLE package,
 * not over the eleven pages anybody typed. A reviewer checking a citation needs
 * to know where in the physical package they are, because that is the number
 * printed on the page and the number they will quote to the county.
 *
 * CONTRACT GAP: zoom is presentational and holds for the life of the mount.
 * `Preferences.default_zoom` exists on the wire and is not wired to this yet.
 */
export function PageNav({
  page,
  totalPages,
  zoom,
  onStep,
  onZoom,
}: {
  page: number;
  totalPages: number;
  zoom: number;
  onStep: (delta: number) => void;
  onZoom: (next: number) => void;
}) {
  const step = "rounded-3 border border-line-strong px-3 py-1 font-mono text-xs text-ink-secondary";

  return (
    <div className="flex items-center gap-4 px-5 py-6">
      <button type="button" aria-label="Previous page" className="text-[10px] text-ink-primary hover:opacity-70" onClick={() => onStep(-1)}>
        ◀
      </button>
      <span className="text-[13px] font-bold text-ink-primary">
        pg {page} of {totalPages}
      </span>
      <button type="button" aria-label="Next page" className="text-[10px] text-ink-primary hover:opacity-70" onClick={() => onStep(1)}>
        ▶
      </button>
    </div>
  );
}
