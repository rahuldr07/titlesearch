import { cx } from "./cx";

/**
 * A LOADING PLACEHOLDER — AND RULE 8 FORBIDS IT ON THE ONE SURFACE WHERE IT
 * WOULD MATTER MOST.
 *
 * "Evidence and deliverables render as paper (--paper-*): serif, warm stock,
 * clerk stamps, justified text. NEVER grey placeholder bars."
 *
 * That refusal cannot be enforced from inside this component: a skeleton cannot
 * see whether the thing it stands in for is a scan. So it is stated here, and
 * the enforcement is the paper surfaces having their own loading treatment. A
 * grey bar where a deed should be is a design defect, not a slow network.
 *
 * `--animate-tp-pulse` is the token file's own keyframe, and the global
 * prefers-reduced-motion rule at the foot of `tokens.css` kills it. It is a
 * 1.4s opacity fade rather than a travelling shimmer: a shimmer is motion
 * across the screen and rule 10 says nothing bounces or slides for decoration.
 *
 * `aria-hidden` plus a live region is deliberately NOT done here. A skeleton
 * that announces itself announces on every keystroke of a filtered list. The
 * pane that owns the fetch announces once, via `@react-aria/live-announcer`.
 */
export function Skeleton({
  width = "full",
  height = "body",
}: {
  readonly width?: "full" | "half" | "quarter" | undefined;
  readonly height?: "label" | "body" | "subject" | undefined;
}) {
  return (
    <span
      aria-hidden
      className={cx(
        "block animate-tp-pulse rounded-sm bg-line-subtle",
        width === "full" && "w-full",
        width === "half" && "w-1/2",
        width === "quarter" && "w-1/4",
        height === "label" && "h-6",
        height === "body" && "h-8",
        height === "subject" && "h-12",
      )}
    />
  );
}
