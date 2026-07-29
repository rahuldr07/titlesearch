import type { MouseEvent } from "react";
import { cn } from "../../shared/ui/classNames";

/**
 * One door in the left rail.
 *
 * PRESENTATIONAL — no router, no fetch (§6: entities render, features fetch).
 * The href is a plain string the smart chrome computes; a left-click navigates
 * through the supplied callback (SPA), while a modified or middle click keeps
 * the real `href` so "open in new tab" still works. Active marking, the label,
 * the collapsed initial and the attention tone all arrive as props.
 *
 * ATTENTION IS A DOT, NEVER A COUNT (attention.ts). A red dot is an unresolved
 * complaint and PULSES (`animate-tp-pulse`); an amber dot is an open gap and
 * stays still. The red/amber split is the rule `sidebar.spec` pins.
 */
export type DoorAttention = "halt" | "attend" | null;

export interface SidebarDoorProps {
  /** Route to navigate to; also the door's stable testid suffix. */
  to: string;
  label: string;
  collapsed: boolean;
  active: boolean;
  attention: DoorAttention;
  onNavigate: (to: string) => void;
}

export function SidebarDoor({ to, label, collapsed, active, attention, onNavigate }: SidebarDoorProps) {
  const initial = label.trim().charAt(0).toUpperCase();
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle modified/aux clicks (new tab) via the real href.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(to);
  };
  return (
    <a
      href={to}
      data-testid={`rail-door-${to}`}
      data-active={active ? "1" : "0"}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-3 rounded-3 text-xs font-medium no-underline",
        collapsed ? "h-22 justify-center px-0" : "h-20 px-4",
        active ? "bg-surface-raised text-ink-primary" : "text-ink-secondary",
      )}
    >
      {collapsed ? (
        <span aria-hidden className="font-mono text-sm">
          {initial}
        </span>
      ) : (
        <span className="truncate capitalize">{label}</span>
      )}
      {attention === null ? null : (
        <span
          data-testid={`rail-dot-${to}`}
          aria-label={attention === "halt" ? `${label}: unresolved` : `${label}: open`}
          className={cn(
            "size-2 shrink-0 rounded-pill",
            collapsed ? "absolute right-2 top-2" : "ml-auto",
            attention === "halt" ? "animate-tp-pulse bg-state-halt" : "bg-state-attend",
          )}
        />
      )}
    </a>
  );
}
