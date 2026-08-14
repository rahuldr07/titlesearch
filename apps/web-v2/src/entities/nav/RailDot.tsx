import { cn } from "../../shared/ui/classNames";

/**
 * THE RAIL'S ATTENTION MARK — a dot, and NEVER a count (`sidebar.spec`).
 *
 * Red pulses and means unresolved; amber is still and means open. That split
 * ARRIVES as a prop: this never reads a number and never decides what a number
 * means (§3). Numbers live on the screen the door leads to, where there is room
 * to say what they are counting.
 *
 * Its own file for the same reason `RailBadge` is: it is a second, independent
 * signal a row can carry, with its own rule about what it may say. It was inline
 * in `RailRow` — the only one of the row's three slots that was — which is what
 * made the two look like different kinds of thing when they are not.
 *
 * COLLAPSED IT MOVES TO THE CORNER. At 78px there is no `ml-auto` to push
 * against, so the dot pins to the row's top-right and rides over the mark rather
 * than displacing it.
 */
export type DoorAttention = "halt" | "attend" | null;

export interface RailDotProps {
  /** The row's path — the dot's testid rides the same namespace as its row. */
  to: string;
  /** Named in the aria-label, so the announcement says WHAT is unresolved. */
  label: string;
  attention: Exclude<DoorAttention, null>;
  collapsed: boolean;
}

export function RailDot({ to, label, attention, collapsed }: RailDotProps) {
  return (
    <span
      data-testid={`rail-dot-${to}`}
      aria-label={attention === "halt" ? `${label}: unresolved` : `${label}: open`}
      className={cn(
        "size-2 shrink-0 rounded-pill",
        collapsed ? "absolute top-2 right-2" : "ml-auto",
        // THE RAIL'S OWN STATE COLOURS, not the app's. `bg-state-halt` is
        // oxblood and measures 1.24:1 on the dark column — the loudest mark in
        // the navigator, invisible, and only in the light theme. Gated at the
        // 3:1 non-text threshold in `contrast.test.ts`.
        attention === "halt"
          ? "animate-tp-pulse bg-rail-attention-halt"
          : "bg-rail-attention-attend",
      )}
    />
  );
}
