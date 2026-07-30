import type { OrderSignoffLine } from "@titlepipe/contract";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * What is still true of a line NOBODY has answered.
 *
 * RULE: the admissible answers are the LINE'S, not the vocabulary's. FAILURE
 * PREVENTED: six of the product's thirteen lines admit N/A and seven do not, so
 * a block that named all three everywhere would be telling a reader the sign-off
 * can record an answer it will refuse. The set is read from `line.answers` and
 * never reconstructed from the group, the number, or the enum — a rule rebuilt
 * in a browser is a second rulebook.
 *
 * THE SUGGESTION IS NAMED, AND IT IS NOT AN ANSWER. `prefilled_from_policy` says
 * THAT policy has an opinion; `policy_suggestion` says WHAT it is. Both are
 * printed, and neither is printed as the line's answer: the line is unsigned
 * until a person answers it, which is the whole of open ruling Q13. A line
 * carrying the flag and no named value says so without inventing one — the flag
 * and the value are two claims and this block may not derive the second.
 *
 * NOTHING RENDERS ONCE A LINE IS ANSWERED. A recorded answer needs no account
 * of what it could have been, and a policy suggestion beside a signature invites
 * the reader to wonder which of the two the record actually holds.
 */
export function SignoffLineNotes({ line }: { line: OrderSignoffLine }) {
  if (line.answer !== null) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-4">
        <Eyebrow variant="caption" className="shrink-0">
          MAY BE ANSWERED
        </Eyebrow>
        <span className="font-mono text-tiny font-semibold text-ink-secondary">
          {line.answers.join(" · ")}
        </span>
      </div>

      {line.prefilled_from_policy ? (
        <p className="text-tiny leading-body text-ink-muted">
          {line.policy_suggestion === null ? (
            "Client policy has a suggested answer on this line"
          ) : (
            <>
              Client policy suggests{" "}
              <span className="font-mono font-semibold">{line.policy_suggestion}</span>
            </>
          )}{" "}
          — <span className="font-semibold text-action-ink">only a person can sign it</span>.
        </p>
      ) : null}
    </div>
  );
}
