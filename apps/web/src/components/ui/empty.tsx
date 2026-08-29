import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * ADAPTED FROM THE REGISTRY `empty`, AND THE COMPOUND API IS THE PART THAT
 * WENT.
 *
 * The registry ships `Empty` / `EmptyHeader` / `EmptyMedia` / `EmptyTitle` /
 * `EmptyDescription` / `EmptyContent` — six slots, every one of them optional.
 * That composes into `<Empty><EmptyTitle>No results</EmptyTitle></Empty>`, and
 * a screen that says only "No results" leaves the reader unable to tell a
 * filter that matched nothing from a queue that is genuinely clear from a fetch
 * that failed quietly. Three very different facts, one blank pane.
 *
 * So `reason` is a REQUIRED PROP and the slots are gone. This is rule 14's
 * typed absence ("absence is typed, never a blank") and rule 9's stated reason,
 * applied to a pane rather than to a value. The primitive does not KNOW the
 * taxonomy — that lives in `entities/`, and a primitive that knew it would not
 * be a primitive — it merely refuses to render without one.
 *
 * `EmptyMedia` is dropped outright rather than retokenised: rule 7 bans icon
 * soup and the glyph vocabulary is ✓ ◆ • T1. A grey circle with a magnifier in
 * it is not in it.
 *
 * The registry's dashed `rounded-xl` border is dropped too. An empty pane is
 * already inside a Card; a dashed box drawn inside a card is a nested card with
 * the fill removed, and nested cards are forbidden.
 *
 * `action` is the way out, and it is optional because some empties have none:
 * "no escalations" is good news and offers nothing to press.
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
