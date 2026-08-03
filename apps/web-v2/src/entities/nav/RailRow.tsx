import type { MouseEvent, ReactNode } from "react";
import { cn } from "../../shared/ui/classNames";
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
    // Let the browser handle modified/aux clicks (new tab) via the real href.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(to);
  };
  /*
   * THE ACTIVE ROW IS MARKED ON ITS LEFT EDGE, not by a floating pill. The
   * mockup runs every rail row full-bleed with a 3px accent bar at the margin,
   * so the marked row reads against the rail's own edge rather than as a rounded
   * tab drifting inside it — which is what tells you where you are at a glance
   * in a column of eleven near-identical rows. The bar is a TRANSPARENT border
   * on every row, never added only when active: a border that appears on
   * selection shifts the label 3px sideways, and a rail whose text jitters as
   * you move through it is the failure this shape prevents. 3px is
   * `--stroke-stamp`, deliberately not `--stroke-severity` (4px) — the left edge
   * at severity weight is banner vocabulary, and a navigator row is not an alarm.
   *
   * THE FILL IS A WASH THAT DIES, not a band (`rail-wash`, the mockup's
   * `linear-gradient(90deg, accent 8%, transparent 70%)`). It replaces
   * `bg-action-surface` — the full-strength CHIP tint, which painted the marked
   * row as a solid slab the width of the rail and made the loudest object on
   * screen the thing pointing at the work rather than the work.
   *
   * GEOMETRY IS THE MOCKUP'S: `py-3 pr-12 pl-10.5` is its `6px 24px 6px 21px`,
   * and 21 + the 3px border is the 24px inset the rest of the rail uses. Height
   * is left to the content — rows were a fixed `h-20` (40px) against the
   * mockup's 27.6px — which is also what makes the 2px group gap read as a gap.
   * COLLAPSED KEEPS ITS 44px: at 78px the mark is the whole target and the whole
   * label, and the two states are never on screen together.
   */
  const rowClass = cn(
    /*
     * `leading-tight` IS NOT COSMETIC. Tailwind v4 pairs every `--text-*` step
     * with a `--text-*--line-height`, and `tokens.css` overrides the SIZES
     * without the paired leadings — so `text-lg` at 13px was inheriting
     * Tailwind's stock ratio for its own `lg` step (1.556) and rendering a
     * 20.2px line box. The row came out 32.2px against the mockup's 27.6px, and
     * nothing about the padding was wrong. 1.25 is `--leading-tight`, the
     * mockup's 1.2 rounded onto the scale this app actually has.
     */
    "relative flex items-center gap-5 border-l-(length:--stroke-stamp) text-lg leading-tight no-underline",
    collapsed ? "h-22 justify-center px-0" : "py-3 pr-12 pl-10.5",
    active
      ? "rail-wash border-l-action font-semibold text-ink-primary"
      : "border-l-transparent font-medium text-ink-secondary",
  );
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
