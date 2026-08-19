import { cn } from "../../shared/ui/classNames";

/**
 * The stepper group from the design: two 26px caps with compound radii and a
 * readout between them, joined by a 1px gap so they read as one control.
 *
 * These are BUTTONS, not just gestures. §6 requires every interactive element
 * be keyboard reachable, and pinch-zoom alone excludes anyone without a
 * trackpad — on the one screen where seeing the page clearly is the entire job.
 */
export function ZoomControls({
  onZoomIn,
  onZoomOut,
  onReset,
  dark = false,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  dark?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <Cap edge="left" onClick={onZoomOut} label="Zoom out" dark={dark}>
        −
      </Cap>
      <button
        type="button"
        onClick={onReset}
        className={cn(
          "h-13 border-y px-5 font-mono text-xs",
          dark
            ? "border-document-line bg-document-card text-document-ink"
            : "border-line-strong bg-surface-panel text-ink-primary",
        )}
      >
        Reset
      </button>
      <Cap edge="right" onClick={onZoomIn} label="Zoom in" dark={dark}>
        +
      </Cap>
    </div>
  );
}

function Cap({
  edge,
  onClick,
  label,
  dark,
  children,
}: {
  edge: "left" | "right";
  onClick: () => void;
  label: string;
  dark: boolean;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "size-13 border text-lg",
        edge === "left" ? "rounded-l-5" : "rounded-r-5",
        dark
          ? "border-document-line bg-document-card text-document-ink"
          : "border-line-strong bg-surface-panel text-ink-primary",
      )}
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}
