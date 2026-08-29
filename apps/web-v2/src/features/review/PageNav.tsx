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
  const step =
    "rounded-3 border border-line-strong px-3 py-1 font-mono text-xs text-ink-secondary";

  return (
    <div className="flex items-center gap-4 border-b border-line-strong px-7 py-4">
      <Eyebrow variant="caption">Document</Eyebrow>
      <button
        type="button"
        aria-label="Previous page"
        className={step}
        onClick={() => onStep(-1)}
      >
        ‹
      </button>
      <span className="font-mono text-xs text-ink-primary">
        p{page} <span className="text-ink-muted">/ {totalPages}</span>
      </span>
      <button
        type="button"
        aria-label="Next page"
        className={step}
        onClick={() => onStep(1)}
      >
        ›
      </button>
      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          aria-label="Zoom out"
          className={step}
          onClick={() => onZoom(zoom - 0.1)}
        >
          −
        </button>
        <span className="font-mono text-xs text-ink-muted">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          aria-label="Zoom in"
          className={step}
          onClick={() => onZoom(zoom + 0.1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
