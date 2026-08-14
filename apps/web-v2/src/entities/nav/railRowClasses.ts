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
 * THE FILL IS A BAND OF PAPER, since 2026-08-13 and the dark rail. It was
 * `rail-wash`, the mockup's `linear-gradient(90deg, accent 8%, transparent 70%)`
 * — correct on the warm-paper column it was drawn for, and invisible on the dark
 * one, where 8% of any hue falls below the just-noticeable step and left the
 * accent bar carrying the signal by itself. On a dark rail the scarce material
 * is PAPER, so the marked row spends it: `--color-rail-active-surface`, flat.
 *
 * That is not a return to `bg-action-surface`, the mistake before the wash. A
 * full-strength CHIP tint made the loudest object on screen the thing pointing
 * at the work rather than the work; the band is the rail's own paper token, and
 * it reads as "this row is a sheet" rather than "this row is an alarm".
 *
 * EVERY COLOUR HERE IS A `rail-*` TOKEN, and that is load-bearing rather than
 * tidy. The rail is one of two surfaces with its own ink vocabulary (the other
 * is the document pane): on `--color-rail-surface`, `--color-ink-primary`
 * measures 1.00:1. A row that reached for the app's ink tiers — or for a literal
 * `bg-white`/`text-slate-900` — would be blank in one theme and frozen against
 * the other, since `[data-theme="mocha"]` redefines the whole family.
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
        /*
         * THE BAR AND THE MARK STAY `action`, NOT `rail-accent`. Both stand on
         * the marked row's BAND, which is paper, not on the rail — so the wax
         * reads at 7.66:1 there exactly as it does anywhere else on a panel, and
         * lightening it would be correcting for a ground it never touches.
         * `rail-accent` is the wax as seen against the dark column, and the only
         * things standing there are the wordmark's halves.
         */
        true: "border-l-action bg-rail-active-surface font-semibold text-rail-ink-active",
        false:
          "border-l-transparent font-medium text-rail-ink-secondary hover:bg-rail-row-hover hover:text-rail-ink",
      },
    },
    defaultVariants: { collapsed: false, active: false },
  },
);
