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
export interface SidebarDoorProps {
  /** Route to navigate to; also the door's stable testid suffix. */
  to: string;
  label: string;
  /** The door's pictograph, from `doorGlyph`. Shown in every state. */
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
          className={cn(
            "shrink-0 text-center leading-flat",
            // 14px is the mockup's `.n-ico` box — a fixed width, so nine
            // different pictographs of nine different widths still put nine
            // labels on one left edge. Collapsed there is no label to align to
            // and the mark is the whole row, so it steps up a size rather than
            // sitting small in the middle of 78px.
            collapsed ? "w-12 text-2xl" : "w-7 text-sm",
            /*
             * TWO GROUNDS, TWO TOKENS. An ACTIVE mark stands on the marked row's
             * band, which is paper, so it takes the wax unchanged (7.66:1). A
             * RESTING mark stands on the dark column, where `--color-ink-muted`
             * measures 1.7:1 — so it takes the rail's own muted tier instead.
             * The mark is the whole row when collapsed; a mark that vanishes
             * takes the door with it.
             */
            active ? "text-action" : "text-rail-ink-muted",
          )}
        >
          {icon}
        </span>
      }
    />
  );
}
