import { cn } from "../../shared/ui/classNames";
import { RailRow, type DoorAttention } from "./RailRow";

/**
 * A door in the left rail: a `RailRow` plus the ICON that marks it.
 *
 * RULE: the mark shows in BOTH states — collapsed and expanded — because the
 * design never drops a door back to unlabelled chrome just because the rail
 * widened. FAILURE PREVENTED: a collapsed 78px rail whose rows are
 * indistinguishable from one another. `doors.test.ts` gates the uniqueness that
 * makes the collapsed state legible at all.
 *
 * THE MARK IS BORDERLESS, and that is the reskin's change here. It was a
 * bordered 20px square holding a letter — nine boxed capitals in a column,
 * which read as a form's field markers rather than as navigation, and which
 * fought the flow rail's discs directly below them for the same attention. The
 * mockup draws a bare 14px pictograph that takes the ACCENT when its row is
 * active and recedes to muted ink when it is not, so the mark participates in
 * the "you are here" signal instead of competing with it.
 *
 * IT IS THE ONE THING `SidebarDoor` STILL OWNS. Everything else about the row —
 * the anchor, the click guard, the testids, the attention dot, the geometry —
 * belongs to `RailRow` and is deliberately NOT repeated here. That repetition is
 * what this file used to be.
 */
import type { ReactNode } from "react";

export interface SidebarDoorProps {
  /** Route to navigate to; also the door's stable testid suffix. */
  to: string;
  label: string;
  /** The door's pictograph, from `doorGlyph`. Shown in every state. */
  icon: ReactNode;
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
          className={cn(
            "shrink-0 text-center flex items-center justify-center",
            collapsed ? "w-22 h-22 text-xl" : "w-9 h-9 [&>svg]:w-full [&>svg]:h-full [&>svg]:stroke-[2px]",
            active ? "text-slate-700" : "text-[#8c899f]",
          )}
        >
          {icon}
        </span>
      }
    />
  );
}
