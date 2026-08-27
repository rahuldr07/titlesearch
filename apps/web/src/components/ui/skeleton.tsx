import { cx } from "./cx";

/**
 * ADAPTED FROM THE REGISTRY `skeleton`, WHICH IS THREE UTILITIES AND A DIV.
 *
 * `animate-pulse` → `animate-tp-pulse`, the token file's own keyframe, because
 * Tailwind's stock pulse is a 2s cubic-bezier the design's three motion timings
 * do not contain, and the global `prefers-reduced-motion` rule at the foot of
 * `tokens.css` kills ours. `bg-muted` → `bg-line-subtle`; `rounded-md` →
 * `rounded-sm`, the 6px inner rung — a placeholder stands INSIDE something.
 *
 * ══ RULE 8 FORBIDS THIS COMPONENT ON THE ONE SURFACE IT WOULD MATTER MOST ═══
 *
 * "Evidence and deliverables render as paper: serif, warm stock, clerk stamps,
 * justified text. NEVER grey placeholder bars." That refusal cannot be enforced
 * from inside here — a skeleton cannot see whether the thing it stands in for
 * is a scan — so it is stated, and the enforcement is the paper surfaces having
 * their own loading treatment. A grey bar where a deed should be is a design
 * defect, not a slow network.
 *
 * WHY THE SIZE IS AN ENUM AND NOT `className`. The registry expects the caller
 * to pass `h-4 w-32`, which is an arbitrary value at every call site and a
 * different rhythm on every screen. These heights are the six type sizes' own
 * line boxes, so a skeleton occupies exactly the space its text will.
 *
 * `aria-hidden` plus a live region is deliberately NOT done: a skeleton that
 * announces itself announces on every keystroke of a filtered list. The pane
 * owning the fetch announces once, via `@react-aria/live-announcer`.
 */
function Skeleton({
  width = "full",
  height = "body",
  className,
}: {
  readonly width?: "full" | "half" | "quarter" | undefined;
  readonly height?: "label" | "body" | "subject" | undefined;
  readonly className?: string | undefined;
}) {
  return (
    <span
      data-slot="skeleton"
      aria-hidden
      className={cx(
        "block animate-tp-pulse rounded-sm bg-line-subtle",
        width === "full" && "w-full",
        width === "half" && "w-1/2",
        width === "quarter" && "w-1/4",
        height === "label" && "h-6",
        height === "body" && "h-8",
        height === "subject" && "h-12",
        className,
      )}
    />
  );
}

export { Skeleton };
