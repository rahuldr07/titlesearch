import { cx } from "./cx";

/**
 * ADAPTED FROM THE REGISTRY `spinner`, WHICH WAS TEN LINES AND TWO DEFECTS.
 *
 * The registry shipped `<Loader2Icon className="size-4 animate-spin" />`. Both
 * halves are replaced:
 *
 *   - `animate-spin` IS TAILWIND'S OWN KEYFRAME, at a stock 1s linear, and the
 *     design ships three timings and no fourth (rule 10). More seriously, the
 *     global `prefers-reduced-motion` block at the foot of `tokens.css` clamps
 *     `animation-duration` to 0.01ms — so under reduced motion a spin does not
 *     STOP, it becomes a strobe at ~100,000 rpm. Verified by reading the rule:
 *     it sets duration, not `animation: none`, and it does so deliberately (a
 *     `transitionend` listener still has to fire). A rotation is the one shape
 *     where that clamp is actively worse than the animation.
 *
 *     So this uses `animate-tp-pulse`, the token file's OWN keyframe, which is
 *     an OPACITY cycle. Clamped to 0.01ms it settles at full opacity and the
 *     glyph simply sits there — a legible resting state rather than a flicker.
 *     Rule 10's "nothing bounces" is satisfied by there being no motion at all.
 *
 *   - `Loader2Icon` is a lucide glyph, and rule 7 closes the vocabulary to
 *     ✓ ◆ • T1. A spinner is not a status mark, so it draws none of them: it is
 *     a ring stroked in `currentColor`, an SVG rather than an icon import, and
 *     it adds nothing to the bundle.
 *
 * ══ THE LABEL IS REQUIRED, AND THAT IS RULE 9 IN ITS OTHER DIRECTION ════════
 *
 * The registry hard-coded `aria-label="Loading"` — which is what a screen
 * reader hears no matter WHICH of the fourteen concurrent fetches this is. Rule
 * 9 makes a control state its reason; a wait is the same obligation seen from
 * the other side, so `label` is required and says what is being waited for.
 * `role="status"` stays: it is a polite live region, so the label is announced
 * when it appears and again when it goes.
 */
export type SpinnerProps = {
  /** What is being waited for, e.g. "Uploading the package". Required. */
  readonly label: string;
  /**
   * The ring's diameter, from the token file's square-control sizes. `sm` sits
   * inside a button's label row; `md` stands alone in a pane.
   */
  readonly size?: "sm" | "md" | undefined;
  readonly className?: string | undefined;
};

export function Spinner({ label, size = "sm", className }: SpinnerProps) {
  return (
    <span
      data-slot="spinner"
      data-size={size}
      role="status"
      aria-label={label}
      className={cx(
        "inline-flex shrink-0 animate-tp-pulse items-center justify-center text-ink-muted",
        size === "sm" ? "size-8" : "size-12",
        className,
      )}
    >
      {/* `aria-hidden`: the live region above already carries the words, and a
          reader announcing a decorative ring twice is worse than silent. */}
      <svg viewBox="0 0 16 16" aria-hidden className="size-full" fill="none">
        {/* The track. `currentColor` at a third, so one ink drives both arcs
            and a spinner on the rail inherits the rail's ink for free. */}
        <circle
          cx="8"
          cy="8"
          r="6"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.25"
        />
        {/* The arc. A quarter turn, drawn with a dash rather than a path so the
            geometry is one number and the stroke stays round at both ends. */}
        <circle
          cx="8"
          cy="8"
          r="6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="10 28"
        />
      </svg>
    </span>
  );
}
