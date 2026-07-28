import { Eyebrow } from "../../shared/ui/Eyebrow";
import { NA_UNCHECKED_NOTE, type SignoffLine } from "./signoffLines";

/**
 * The three annotations that sit under a sign-off question.
 *
 * Each one exists to stop a specific misreading, and none of them is optional
 * detail:
 *
 *  - SCOPE / PERIOD says what the client bought, so "yes" is answered against
 *    the ordered span rather than against habit.
 *  - NO MACHINE CHECK says this line has no signal behind it at all, so an N/A
 *    here will never be contradicted later. Silence from a check that was never
 *    run reads identically to a check that passed unless the row says so.
 *  - NOT ANSWERED carries the policy suggestion WITHOUT selecting it. The
 *    suggestion is visible and still costs a deliberate press, which is the
 *    whole distinction between a policy and a signature (open ruling Q13).
 */
export function SignoffRowNotes({
  line,
  answered,
}: {
  line: SignoffLine;
  answered: boolean;
}) {
  const naUnchecked = line.answers.includes("N/A") && !line.naVerified;

  return (
    <>
      {line.periodText === null ? null : (
        <div className="mt-3 inline-flex items-baseline gap-4 rounded-5 border border-action-border bg-action-surface px-5 py-2">
          <Eyebrow variant="caption" tone="action">
            Scope / period
          </Eyebrow>
          <span className="font-mono text-xs font-semibold text-action-ink">
            {line.periodText}
          </span>
        </div>
      )}

      {naUnchecked ? (
        <div className="mt-3 flex max-w-full items-baseline gap-4 rounded-5 border border-dashed border-state-attend-border bg-state-attend-surface px-5 py-2">
          <Eyebrow variant="caption" tone="attend" className="shrink-0">
            No machine check
          </Eyebrow>
          <span className="text-tiny leading-body text-ink-secondary">{NA_UNCHECKED_NOTE}</span>
        </div>
      ) : null}

      {answered ? null : (
        <div className="mt-2 flex items-center gap-4">
          <Eyebrow variant="caption" tone="action">
            ◇ Not answered
          </Eyebrow>
          <span className="text-tiny text-ink-muted">
            Policy suggests{" "}
            <span className="font-semibold text-action-ink">{line.suggested}</span>
          </span>
        </div>
      )}
    </>
  );
}
