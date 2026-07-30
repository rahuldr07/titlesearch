import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../../shared/ui/classNames";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { SidebarDoor, type SidebarDoorProps } from "./SidebarDoor";
import { LifecycleRail, type LifecycleStage } from "./LifecycleRail";

/**
 * The collapsible LEFT SIDEBAR (§11) — the navigator, back on the left where
 * the approved design draws it. 232px wide, 78px collapsed; row heights 40/44px.
 *
 * GROUPED SECTIONS (Task 12) — uppercase headers in a fixed order: WORK, THIS
 * ORDER (the numbered `LifecycleRail`), ADMIN, REFERENCE. `AppChrome` decides
 * which sections exist and in what order by the `sections` array it hands
 * down; this component only walks it and draws headers + bodies, so the
 * "four headers, in order" invariant is one array, not four hand-written
 * branches that could drift apart.
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

export type SidebarSection =
  | { kind: "doors"; label: string; doors: readonly SidebarDoorItem[] }
  | { kind: "lifecycle"; label: string; stages: readonly LifecycleStage[] };

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate: (to: string) => void;
  brand: ReactNode;
  sections: readonly SidebarSection[];
  /** Optional — the account menu moved to `OrderStrip` (§11 2026-07-30 revision). */
  foot?: ReactNode;
}

/** Below this rail-container width the labels no longer fit and collapse is FORCED. */
const FORCE_COLLAPSE_BELOW = 900;

export function Sidebar({ collapsed, onToggle, onNavigate, brand, sections, foot }: SidebarProps) {
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

      {sections.map((section, i) => (
        <div
          key={section.label}
          className={cn("flex flex-col gap-1", i === 0 ? "" : "border-t border-line-subtle pt-4")}
        >
          {isCollapsed ? null : (
            <Eyebrow as="h2" variant="group" className="px-2 pb-1">
              {section.label}
            </Eyebrow>
          )}
          {section.kind === "lifecycle" ? (
            <LifecycleRail stages={section.stages} collapsed={isCollapsed} onNavigate={onNavigate} />
          ) : (
            section.doors.map((door) => (
              <SidebarDoor key={door.to} {...door} collapsed={isCollapsed} onNavigate={onNavigate} />
            ))
          )}
        </div>
      ))}

      {foot === undefined ? null : (
        <div className="mt-auto border-t border-line-subtle pt-4">{foot}</div>
      )}
    </aside>
  );
}
