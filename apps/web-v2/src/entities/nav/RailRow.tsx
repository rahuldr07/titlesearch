import type { MouseEvent, ReactNode } from "react";
import { cn } from "../../shared/ui/classNames";

/**
 * ONE ROW OF THE RAIL — the door row and the lifecycle stage row are one
 * component, because they were one component written twice.
 *
 * RULE: a rail row has a single renderer. FAILURE PREVENTED: `SidebarDoor` and
 * `LifecycleRail` each held ~35 byte-identical lines — the same anchor, the
 * same modified-click guard, the same `rail-door-*`/`rail-dot-*` testids and
 * the same className string — and six separate fidelity fixes land inside that
 * block. With two copies each fix is applied twice and one of them is missed.
 *
 * A LEFT CLICK NAVIGATES THROUGH THE CALLBACK; a modified or middle click is
 * left to the browser so the real `href` still opens a new tab. Dropping that
 * turns a navigator of links into a navigator of buttons.
 *
 * ATTENTION IS A DOT, NEVER A COUNT (`sidebar.spec`). Red pulses and means
 * unresolved, amber is still and means open. The split ARRIVES as a prop: this
 * row never reads a number and never decides what a number means (§3).
 *
 * PRESENTATIONAL — no router, no fetch (§6). The marker and the badge are
 * slots, which is exactly what lets one row draw two different rails without
 * knowing anything about either.
 */
export type DoorAttention = "halt" | "attend" | null;

export interface RailRowProps {
  /** Route to navigate to; also the row's stable testid suffix. */
  to: string;
  label: string;
  active: boolean;
  collapsed: boolean;
  attention: DoorAttention;
  /** The letter square, or the numbered/checked stage dot. */
  marker: ReactNode;
  badge?: ReactNode;
  onNavigate: (to: string) => void;
  /**
   * Hover/AT text, present in BOTH states. The collapsed rail needs it to name
   * the row at all; the wide rail uses it to carry the chord, which is where a
   * chord is learned — never from a one-letter square.
   */
  title?: string;
  /**
   * `false` draws a fixed POSITION rather than a link — the Review stage before
   * an order is in view. The row still counts (the numbering is structural);
   * it just does not offer a journey the app cannot make.
   */
  reachable?: boolean;
}

export function RailRow({
  to,
  label,
  active,
  collapsed,
  attention,
  marker,
  badge,
  onNavigate,
  title,
  reachable,
}: RailRowProps) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle modified/aux clicks (new tab) via the real href.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(to);
  };
  const rowClass = cn(
    "relative flex items-center gap-3 rounded-3 text-xs font-medium no-underline",
    collapsed ? "h-22 justify-center px-0" : "h-20 px-4",
    active ? "bg-surface-raised text-ink-primary" : "text-ink-secondary",
  );
  const body = (
    <>
      {marker}
      {collapsed ? null : (
        <>
          <span className="truncate capitalize">{label}</span>
          {badge}
        </>
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
    </>
  );

  if (reachable === false) {
    return (
      <span
        data-testid={`rail-door-${to}`}
        data-active="0"
        aria-disabled="true"
        title={title ?? `${label} — opens once an order is in view`}
        className={cn(rowClass, "text-ink-muted")}
      >
        {body}
      </span>
    );
  }

  return (
    <a
      href={to}
      data-testid={`rail-door-${to}`}
      data-active={active ? "1" : "0"}
      aria-current={active ? "page" : undefined}
      title={title ?? (collapsed ? label : undefined)}
      onClick={onClick}
      className={rowClass}
    >
      {body}
    </a>
  );
}
