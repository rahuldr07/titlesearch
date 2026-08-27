import type { ReactNode } from "react";

/**
 * NOTHING HERE, AND WHY.
 *
 * `reason` is required, and that is the whole design. An empty state that says
 * only "No results" leaves the reader unable to tell a filter that matched
 * nothing from a queue that is genuinely clear from a fetch that failed
 * quietly — three very different facts, one blank screen.
 *
 * This is the same instinct as rule 14's typed absence ("absence is typed,
 * never a blank") and rule 9's stated reason, applied to a pane rather than to
 * a value. The primitive does not KNOW the taxonomy — that lives in entities,
 * and a primitive that knew it would not be a primitive — it merely refuses to
 * render without one.
 *
 * `action` is the way out, and it is optional because some empties have none:
 * "no escalations" is good news and offers nothing to press.
 */
export function EmptyState({
  title,
  reason,
  action,
}: {
  readonly title: string;
  /** Why the pane is empty, in the words of whoever knows. */
  readonly reason: string;
  readonly action?: ReactNode | undefined;
}) {
  return (
    <div className="flex flex-col items-center gap-6 px-12 py-16 text-center">
      <p className="font-sans text-subject leading-close font-semibold text-ink-primary">
        {title}
      </p>
      <p className="max-w-160 font-sans text-meta leading-body text-ink-secondary">{reason}</p>
      {action !== undefined && <div className="pt-4">{action}</div>}
    </div>
  );
}
