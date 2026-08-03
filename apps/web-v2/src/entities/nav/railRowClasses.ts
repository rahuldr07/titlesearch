import { cva } from "class-variance-authority";

/**
 * THE GEOMETRY OF ONE RAIL ROW, as a pure function of its two states.
 *
 * Its own module for the reason `Button` exports `buttonClasses` and `RailBadge`
 * exports `railBadgeClasses`: the styling decision is testable without a DOM,
 * and the reasoning behind it is long enough that leaving it inline buried the
 * component that uses it.
 *
 * THE ACTIVE ROW IS MARKED ON ITS LEFT EDGE, not by a floating pill. The mockup
 * runs every rail row full-bleed with a 3px accent bar at the margin, so the
 * marked row reads against the rail's own edge rather than as a rounded tab
 * drifting inside it — which is what tells you where you are at a glance in a
 * column of eleven near-identical rows.
 *
 * THE BAR IS A TRANSPARENT BORDER ON EVERY ROW, never added only when active: a
 * border that appears on selection shifts the label 3px sideways, and a rail
 * whose text jitters as you move through it is the failure this shape prevents.
 * 3px is `--stroke-stamp`, deliberately not `--stroke-severity` (4px) — the left
 * edge at severity weight is banner vocabulary, and a navigator row is not an
 * alarm.
 *
 * THE FILL IS A WASH THAT DIES, not a band (`rail-wash`, the mockup's
 * `linear-gradient(90deg, accent 8%, transparent 70%)`). It replaces
 * `bg-action-surface` — the full-strength CHIP tint, which painted the marked
 * row as a solid slab the width of the rail and made the loudest object on
 * screen the thing pointing at the work rather than the work.
 *
 * MEASUREMENTS ARE THE MOCKUP'S: `py-3 pr-12 pl-10.5` is its `6px 24px 6px
 * 21px`, and 21 + the 3px border is the 24px inset the rest of the rail uses.
 * Height is left to the content — rows were a fixed `h-20` (40px) against the
 * mockup's 27.6px — which is also what makes the 2px group gap read as a gap.
 *
 * `leading-tight` IS LOAD-BEARING, not taste. A bare `text-lg` carries
 * Tailwind's stock leading rather than the design's and drew this row 4.6px too
 * tall with every padding value correct; `tokens.css`'s `--text-*` block states
 * that trap in full, and any dense row in this app is exposed to it.
 *
 * COLLAPSED KEEPS ITS 44px and does not follow the expanded row down to 27.6px:
 * at 78px the mark is the whole target and the whole label, and the two states
 * are never on screen together.
 */
export const railRowClasses = cva(
  "relative flex items-center gap-5 border-l-(length:--stroke-stamp) text-lg leading-tight no-underline",
  {
    variants: {
      collapsed: {
        true: "h-22 justify-center px-0",
        false: "py-3 pr-12 pl-10.5",
      },
      active: {
        true: "rail-wash border-l-action font-semibold text-ink-primary",
        false: "border-l-transparent font-medium text-ink-secondary",
      },
    },
    defaultVariants: { collapsed: false, active: false },
  },
);
