import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * An empty pane with a required `reason`: "No results" alone cannot tell a
 * filter that matched nothing from a queue that is genuinely clear from a
 * fetch that failed quietly. The primitive does not know the taxonomy — that
 * lives in entities/ — it merely refuses to render without a reason.
 * `action` is optional because some empties have no way out: "no
 * escalations" is good news and offers nothing to press.
 */
function Empty({
  title,
  reason,
  action,
  className,
}: {
  readonly title: string;
  /** Why the pane is empty, in the words of whoever knows. Required. */
  readonly reason: string;
  readonly action?: ReactNode | undefined;
  readonly className?: string | undefined;
}) {
  return (
    <div
      data-slot="empty"
      className={cx(
        "flex w-full min-w-0 flex-col items-center justify-center gap-6 px-12 py-16 text-center",
        className,
      )}
    >
      <p
        data-slot="empty-title"
        className="font-sans text-subject leading-close font-semibold text-ink-primary"
      >
        {title}
      </p>
      <p
        data-slot="empty-reason"
        className="max-w-160 font-sans text-meta leading-body text-ink-secondary"
      >
        {reason}
      </p>
      {action !== undefined && (
        <div data-slot="empty-action" className="pt-4">
          {action}
        </div>
      )}
    </div>
  );
}

export { Empty };
