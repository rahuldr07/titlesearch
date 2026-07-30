import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../../shared/ui/classNames";
import { SidebarDoor, type SidebarDoorProps } from "./SidebarDoor";
import { LifecycleRail, type LifecycleStage } from "./LifecycleRail";

/**
 * The collapsible LEFT SIDEBAR (§11) — the navigator, back on the left where
 * the approved design draws it. 232px wide, 78px collapsed; row heights 40/44px.
 *
 * PRESENTATIONAL — no router, no fetch (§6). The smart chrome computes the door
 * set, active marking, attention and the persisted collapse, and passes the
 * account menu in as the `foot` slot. Two things this component OWNS because
 * they are pure DOM, not data:
 *
 *   - The collapse ATTRIBUTE and width. The base collapse is the persisted
 *     preference (merged upstream with the Review first-mount default).
 *   - FORCED collapse at narrow widths, measured with a ResizeObserver on the
 *     rail's OWN CONTAINER — never `window.innerWidth`. The screenshot harness
 *     renders at a container width that differs from the viewport, so container
 *     starvation must read identically at every viewport (trap §6). A forced
 *     collapse is display-only: it never writes the preference, so widening the
 *     window restores the user's real choice.
 */
export type SidebarDoorItem = Omit<SidebarDoorProps, "collapsed" | "onNavigate">;

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate: (to: string) => void;
  brand: ReactNode;
  lifecycle: readonly LifecycleStage[];
  worlds: readonly SidebarDoorItem[];
  /** Optional — the account menu moved to `OrderStrip` (§11 2026-07-30 revision). */
  foot?: ReactNode;
}

/** Below this rail-container width the labels no longer fit and collapse is FORCED. */
const FORCE_COLLAPSE_BELOW = 900;

export function Sidebar({ collapsed, onToggle, onNavigate, brand, lifecycle, worlds, foot }: SidebarProps) {
  const ref = useRef<HTMLElement>(null);
  const [forced, setForced] = useState(false);

  useEffect(() => {
    const container = ref.current?.parentElement;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? Number.POSITIVE_INFINITY;
      setForced(width < FORCE_COLLAPSE_BELOW);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const isCollapsed = forced || collapsed;

  return (
    <aside
      ref={ref}
      data-testid="side-rail"
      data-collapsed={isCollapsed ? "1" : "0"}
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col gap-4 overflow-y-auto border-r border-line-strong bg-surface-panel py-4",
        isCollapsed ? "w-39 px-2" : "w-116 px-3",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        {isCollapsed ? null : brand}
        <button
          type="button"
          data-testid="rail-toggle"
          aria-pressed={isCollapsed}
          aria-label={isCollapsed ? "Expand the navigator" : "Fold the navigator"}
          onClick={onToggle}
          className="shrink-0 rounded-3 border border-line-strong px-3 py-2 font-mono text-micro text-ink-secondary"
        >
          [
        </button>
      </div>

      <LifecycleRail stages={lifecycle} collapsed={isCollapsed} onNavigate={onNavigate} />

      {worlds.length === 0 ? null : (
        <div className="flex flex-col gap-1 border-t border-line-subtle pt-4">
          {worlds.map((door) => (
            <SidebarDoor key={door.to} {...door} collapsed={isCollapsed} onNavigate={onNavigate} />
          ))}
        </div>
      )}

      {foot === undefined ? null : (
        <div className="mt-auto border-t border-line-subtle pt-4">{foot}</div>
      )}
    </aside>
  );
}
