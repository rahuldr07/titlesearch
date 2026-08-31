import { cx } from "./cx";

/**
 * Pulses rather than spins: the global prefers-reduced-motion block clamps
 * animation-duration to 0.01ms rather than setting `animation: none` (a
 * transitionend listener still has to fire), and a rotation under that clamp
 * is a strobe. `animate-tp-pulse` is an opacity cycle that settles at full
 * opacity and simply sits there.
 *
 * `label` is required and says what is being waited for — a hard-coded
 * "Loading" is what a reader would hear no matter which of fourteen
 * concurrent fetches this is. `role="status"` is a polite live region, so
 * the label is announced when it appears and again when it goes.
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
