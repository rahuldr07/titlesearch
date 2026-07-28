import type { OrderSignoffLine } from "@titlepipe/contract";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * The three annotations that sit under a sign-off question.
 *
 * Each one exists to stop a specific misreading, and none of them is optional
 * detail:
 *
 *  - SCOPE / PERIOD says what the client bought, so "yes" is answered against
 *    the ordered span rather than against habit. The row carries the flag; the
 *    span itself is the order's, which is why it arrives as a prop.
 *  - NO MACHINE CHECK says this line has no signal behind it at all, so an N/A
 *    here will never be contradicted later. Silence from a check that was never
 *    run reads identically to a check that passed unless the row says so — and
 *    where a check DOES exist the row names it rather than implying one.
 *  - NOT ANSWERED carries the fact that policy has a prefill WITHOUT applying
 *    it. The prefill is visible and still costs a deliberate press, which is the
 *    whole distinction between a policy and a signature (open ruling Q13).
 *
 * CONTRACT GAP: `prefilled_from_policy` is a boolean. The design prints the
 * suggestion outright — "Policy suggests YES" — and outlines the button that
 * answer would land on. The wire says only THAT a policy answer exists, never
 * WHICH, so this row says the same thing without the value. Reading the
 * suggestion off the button set would be the screen inventing a policy.
 */
const NA_UNCHECKED_NOTE =
  "An N/A on this line is not verified against the package and raises no gate.";

export function SignoffRowNotes({
  line,
  periodLabel,
  answered,
}: {
  line: OrderSignoffLine;
  periodLabel: string;
  answered: boolean;
}) {
  return (
    <>
      {line.period_scoped ? (
        <div className="mt-3 inline-flex items-baseline gap-4 rounded-5 border border-action-border bg-action-surface px-5 py-2">
          <Eyebrow variant="caption" tone="action" className="shrink-0">
            SCOPE / PERIOD
          </Eyebrow>
          <span className="font-mono text-xs font-semibold text-action-ink">{periodLabel}</span>
        </div>
      ) : null}

      {line.machine_check === null ? (
        <div className="mt-3 flex max-w-full items-baseline gap-4 rounded-5 border border-dashed border-state-attend-border bg-state-attend-surface px-5 py-2">
          <Eyebrow variant="caption" tone="attend" className="shrink-0">
            NO MACHINE CHECK
          </Eyebrow>
          <span className="text-tiny leading-body text-ink-secondary">{NA_UNCHECKED_NOTE}</span>
        </div>
      ) : (
        <div className="mt-3 flex max-w-full items-baseline gap-4">
          <Eyebrow variant="caption" className="shrink-0">
            MACHINE CHECK
          </Eyebrow>
          <span className="text-tiny leading-body text-ink-muted">{line.machine_check}</span>
        </div>
      )}

      {answered ? null : (
        <div className="mt-2 flex flex-wrap items-baseline gap-4">
          <Eyebrow variant="caption" tone="action" className="shrink-0">
            ◇ NOT ANSWERED
          </Eyebrow>
          {line.prefilled_from_policy ? (
            <span className="text-tiny leading-body text-ink-muted">
              Policy suggests an answer —{" "}
              <span className="font-semibold text-action-ink">only your press signs it</span>.
            </span>
          ) : null}
        </div>
      )}
    </>
  );
}
