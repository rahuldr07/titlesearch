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
 *    run reads identically to a check that passed unless the row says so. Only
 *    the absence is drawn; see the branch below for why the present case is not.
 *  - NOT ANSWERED carries the fact that policy has a prefill WITHOUT applying
 *    it. The prefill is visible and still costs a deliberate press, which is the
 *    whole distinction between a policy and a signature (open ruling Q13).
 *
 * THE SUGGESTION IS NAMED NOW (2026-07-30, Wave 2). `prefilled_from_policy`
 * says THAT policy suggested; `policy_suggestion` says WHAT it suggested, and
 * the design prints it outright — "Policy suggests YES". Both are read, and
 * neither is read as an answer: the line is unanswered until a person presses,
 * which is the whole of ruling Q13. A row that carries the flag and no value
 * still says so without naming one — the flag and the value are two claims and
 * the screen may not invent the second from the first.
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
          <span className="font-mono text-xs font-semibold text-action-ink">
            {periodLabel}
          </span>
        </div>
      ) : null}

      {/*
        ONLY THE ABSENCE IS DRAWN. The chip fires when `machine_check` is null
        and there is no positive twin, because the two say different-sized
        things: "nothing will ever contradict this answer" changes how the line
        should be answered, and "something will" does not — the abstractor
        answers what they did either way, and the check runs whether or not the
        row mentions it. Captioning the present case put a third line on all
        thirteen rows and made the one row that mattered harder to find, which
        is the opposite of what the chip is for.
      */}
      {line.machine_check === null ? (
        <div className="mt-3 flex max-w-full items-baseline gap-4 rounded-5 border border-dashed border-state-attend-border bg-state-attend-surface px-5 py-2">
          <Eyebrow variant="caption" tone="attend" className="shrink-0">
            NO MACHINE CHECK
          </Eyebrow>
          <span className="text-tiny leading-body text-ink-secondary">
            {NA_UNCHECKED_NOTE}
          </span>
        </div>
      ) : null}

      {answered ? null : (
        <div className="mt-2 flex flex-wrap items-baseline gap-4">
          <Eyebrow variant="caption" tone="action" className="shrink-0">
            ◇ NOT ANSWERED
          </Eyebrow>
          {line.prefilled_from_policy ? (
            <span className="text-tiny leading-body text-ink-muted">
              {line.policy_suggestion === null ? (
                "Policy suggests an answer"
              ) : (
                <>
                  Policy suggests{" "}
                  <span className="font-mono font-semibold">
                    {line.policy_suggestion}
                  </span>
                </>
              )}{" "}
              —{" "}
              <span className="font-semibold text-action-ink">
                only your press signs it
              </span>
              .
            </span>
          ) : null}
        </div>
      )}
    </>
  );
}
