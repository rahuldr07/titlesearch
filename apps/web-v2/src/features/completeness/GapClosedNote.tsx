import type { Gap } from "./gapFixtures";
import type { GapClosure } from "./useGateState";

/**
 * What closing this gap actually did — kept on the card afterwards.
 *
 * A CLOSED GAP IS NOT AN EMPTY SPACE. The record of how it closed is the part
 * that matters later: which document arrived, which signed answer was changed
 * and from what, whose word the root of title rests on. Replacing all three
 * with a tick would leave the person reading the order next month unable to
 * tell a supplement from a rewritten assertion.
 *
 * The amendment note says the original answer stays in the record, because the
 * fear that amending erases what you signed is what makes people leave a wrong
 * answer standing.
 *
 * The root-of-title comment is set in the serif face — this codebase's marker
 * for human testimony as against machine output. It is somebody's word, and it
 * should not look like a field value.
 */
export function GapClosedNote({
  gap,
  closure,
  packagePages,
}: {
  gap: Gap;
  closure: GapClosure;
  packagePages: number;
}) {
  if (closure.kind === "uploaded") {
    return (
      <div className="flex items-center gap-5 rounded-7 border border-state-settled-border bg-state-settled-surface px-7 py-5">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-state-settled text-sm text-ink-on-action"
        >
          ✓
        </span>
        <p className="text-sm leading-body text-state-settled-ink">
          <span className="font-mono font-semibold">{gap.docName}</span> ({gap.docPages} pages)
          attached to the package — not replacing it. Package now {packagePages} pages.
        </p>
      </div>
    );
  }

  if (closure.kind === "amended") {
    return (
      <div className="rounded-7 border border-action-border bg-action-surface px-7 py-5">
        <p className="text-sm leading-body text-action-ink">
          <span className="font-bold">Amended from {closure.from} → NO.</span> This is a change
          to a signed assertion and will be recorded on the sheet. The original answer stays in
          the record.
        </p>
      </div>
    );
  }

  if (closure.kind === "rooted") {
    return (
      <div className="rounded-7 border border-state-settled-border bg-state-settled-surface px-7 py-5">
        <p className="mb-2 text-sm leading-body text-state-settled-ink">
          <span className="font-bold">Root of title reached.</span> The search is asserted
          complete — nothing older is of record.
        </p>
        <p className="border-l-2 border-state-settled pl-4 font-quote text-sm leading-open text-ink-secondary">
          “{closure.comment}”
        </p>
        <p className="mt-2 text-tiny text-ink-muted">Recorded by {closure.by}</p>
      </div>
    );
  }

  return null;
}
