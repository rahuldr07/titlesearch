/**
 * What closing this gap actually did — kept on the card afterwards.
 *
 * A CLOSED GAP IS NOT AN EMPTY SPACE. The record of how it closed is the part
 * that matters later: which way out was taken, on whose word, and why.
 * Replacing all of that with a tick would leave the person reading the order
 * next month unable to tell a supplement from a rewritten assertion.
 *
 * The reason is set in the serif face — this codebase's marker for human
 * testimony as against machine output. It is somebody's word, and it should not
 * look like a field value.
 */
export function GapClosedNote({
  option,
  note,
  by,
}: {
  option: string;
  note: string | null;
  by: string | null;
}) {
  return (
    <div className="rounded-7 border border-state-settled-border bg-state-settled-surface px-7 py-5">
      <div className="flex items-center gap-5">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-state-settled text-sm text-ink-on-action"
        >
          ✓
        </span>
        <p className="text-sm leading-body text-state-settled-ink">
          <span className="font-bold">{option}.</span> The original claim stays in the record —
          closing a gap adds to the order&apos;s history, it never rewrites it.
        </p>
      </div>

      {note === null ? null : (
        <p className="mt-4 border-l-2 border-state-settled pl-4 font-quote text-sm leading-open text-ink-secondary">
          “{note}”
        </p>
      )}

      {by === null ? null : <p className="mt-2 text-tiny text-ink-muted">Recorded by {by}</p>}
    </div>
  );
}
