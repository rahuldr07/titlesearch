import type { Field } from "@titlepipe/contract";
import { ScreenTitle } from "../../app/ScreenTitle";

/**
 * THE COUNTER IS ANSWERED-OF-NEEDED, not a rate and not a countdown to beat.
 *
 * "Remaining" alone reads as a burn-down; answered-of-needed says the work is
 * finite and how much of it a person has actually decided. Neither is a pace:
 * there is no clock on this screen and no per-reviewer number anywhere in the
 * product, because the moment "how fast" is visible, "how carefully" stops
 * being the thing being optimised.
 *
 * A PENDING FIELD IS IN NEITHER DENOMINATOR. The pipeline has not looked at it,
 * so it is not something a reviewer has failed to answer.
 */
export function ReviewHeader({ fields, queued }: { fields: readonly Field[]; queued: number }) {
  const needed = fields.filter((field) => field.state !== "pending");
  const answered = needed.filter((field) => field.state !== "needs_review");

  return (
    <header className="flex flex-wrap items-baseline gap-6">
      <ScreenTitle>Review</ScreenTitle>
      <span className="font-mono text-xs text-ink-muted">
        {answered.length} of {needed.length} answered
      </span>
      <span className="font-mono text-xs text-ink-muted">{queued} remaining</span>
      <span className="text-xs text-ink-muted">
        One at a time. Click a line to see where it was read from.
      </span>
    </header>
  );
}
