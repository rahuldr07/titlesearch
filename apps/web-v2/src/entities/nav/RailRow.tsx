import type { MouseEvent, ReactNode } from "react";
import { cn } from "../../shared/ui/classNames";
import { isPlainClick } from "../../shared/ui/plainClick";
import { railRowClasses } from "./railRowClasses";
import { RailDot, type DoorAttention } from "./RailDot";

export type { DoorAttention } from "./RailDot";

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
 * PRESENTATIONAL — no router, no fetch (§6). The marker and the badge are
 * slots, and the attention dot is `RailDot`, which is exactly what lets one row
 * draw two different rails without knowing anything about either.
 */
export interface RailRowProps {
  /** Route to navigate to; also the row's stable testid suffix. */
  to: string;
  label: string;
  active: boolean;
  collapsed: boolean;
  attention: DoorAttention;
  /** The door's pictograph, or the numbered/checked stage dot. */
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
    // Modified and middle clicks belong to the BROWSER — `isPlainClick` states
    // why, and the real `href` below is what makes deferring to it work.
    if (!isPlainClick(event)) return;
    event.preventDefault();
    onNavigate(to);
  };
  // The geometry, the accent edge and the active wash live in
  // `railRowClasses` — a pure function of these two booleans, and the reasoning
  // for every value in it is there.
  const rowClass = railRowClasses({ collapsed, active });
  const body = (
    <>
      {marker}
      {collapsed ? null : (
        <>
          {/*
            SENTENCE CASE, NOT TITLE CASE. `capitalize` uppercases every word, so
            `products & sign-off` drew "Products & Sign-Off" — headline caps
            beside a design whose own label reads "Products & sign-off". The
            catalogue stores lowercase because a label is also spoken in the `?`
            map's sentences; only the rail titles it.
          */}
          <span className="truncate first-letter:uppercase">{label}</span>
          {badge}
        </>
      )}
      {attention === null ? null : (
        <RailDot to={to} label={label} attention={attention} collapsed={collapsed} />
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
        // The rail's muted tier, not the app's: this row stands on the dark
        // column, where `--color-ink-muted` measures 2.64:1. An unreachable stage
        // is meant to read as PRESENT BUT NOT YET YOURS — the numbering is
        // structural and has to stay countable — not as a gap in the list.
        className={cn(rowClass, "text-rail-ink-muted")}
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
