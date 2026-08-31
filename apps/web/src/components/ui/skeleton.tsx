import { cx } from "./cx";

/**
 * Never on paper: evidence renders as paper, never grey placeholder bars —
 * a skeleton cannot see whether it stands in for a scan, so the refusal is
 * enforced by the paper surfaces having their own loading treatment.
 *
 * Size is an enum, not className: the heights are the type sizes' own line
 * boxes, so a skeleton occupies exactly the space its text will. It does not
 * announce itself — a skeleton that did would announce on every keystroke of
 * a filtered list; the pane owning the fetch announces once.
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
