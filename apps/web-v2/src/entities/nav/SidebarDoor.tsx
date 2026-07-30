import { RailRow, type DoorAttention } from "./RailRow";

/**
 * A door in the left rail: a `RailRow` plus the LETTER SQUARE that marks it.
 *
 * RULE: the square shows in BOTH states — collapsed and expanded — because the
 * design never drops a door back to unlabelled chrome just because the rail
 * widened. FAILURE PREVENTED: a collapsed 78px rail whose rows are
 * indistinguishable from one another.
 *
 * THE LETTER IS THE LABEL'S INITIAL, NOT THE CHORD (ruling D2). It arrives
 * already derived from `doorGlyph`; the chord it used to duplicate now rides
 * `title` and the `?` map, where a chord is actually learned.
 *
 * Everything else about the row — the anchor, the click guard, the testids, the
 * attention dot, the geometry — belongs to `RailRow` and is deliberately NOT
 * repeated here. That repetition is what this file used to be.
 */
export interface SidebarDoorProps {
  /** Route to navigate to; also the door's stable testid suffix. */
  to: string;
  label: string;
  /** Single-letter glyph (the label's initial), shown in every state. */
  icon: string;
  /** Hover/AT text: the door and the chord that opens it. Every door has one. */
  title: string;
  collapsed: boolean;
  active: boolean;
  attention: DoorAttention;
  onNavigate: (to: string) => void;
}

export function SidebarDoor({
  to,
  label,
  icon,
  title,
  collapsed,
  active,
  attention,
  onNavigate,
}: SidebarDoorProps) {
  return (
    <RailRow
      to={to}
      label={label}
      title={title}
      collapsed={collapsed}
      active={active}
      attention={attention}
      onNavigate={onNavigate}
      marker={
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-2 border border-line-strong font-mono text-micro text-ink-secondary"
        >
          {icon}
        </span>
      }
    />
  );
}
