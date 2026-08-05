import type { OrderSignoffLine, SignoffAnswer } from "@titlepipe/contract";
import { Button } from "../../shared/ui/Button";
import { cn } from "../../shared/ui/classNames";

/**
 * The answer buttons for one sign-off line, in the four states the design draws.
 *
 * THE ANSWER SET IS THE LINE'S, NOT THE VOCABULARY'S. `line.answers` says what
 * THIS line may be answered — six of the product's thirteen admit N/A, seven do
 * not — so the row draws exactly those buttons. Deriving the set from a group
 * or a line number here would be a second rulebook, free to offer an answer the
 * sign-off cannot record.
 *
 * THE UNCHOSEN BUTTONS RECEDE ONCE A ROW IS ANSWERED (design `soOptions`:
 * bg panel, fg ink3, border rule2). RULE: somebody scanning thirteen lines has
 * to find the ones still owing an answer without reading them. FAILURE
 * PREVENTED: at equal weight a settled row's two spare buttons look exactly
 * like an unanswered row's two live ones, so the eye has to check the fill of
 * the third to tell them apart. The row's edge and ground already carry that
 * signal; this is the last piece of it.
 *
 * THE SUGGESTED OPTION IS OUTLINED, NEVER FILLED. Policy's suggestion is drawn
 * on the button it would land on, so answering along with policy is one
 * deliberate press rather than a hunt — and drawn as an OUTLINE, because a
 * filled button is what a CHOSEN answer looks like and open ruling Q13 turns
 * entirely on a suggestion never being mistaken for one. The suggestion
 * disappears the moment the line is answered: it described what policy proposed
 * before a person acted, and after they act it is only noise beside their
 * signature.
 */
export function SignoffRowAnswers({
  line,
  answer,
  onAnswer,
}: {
  line: OrderSignoffLine;
  answer: SignoffAnswer | undefined;
  onAnswer: (answer: SignoffAnswer) => void;
}) {
  const answered = answer !== undefined;

  return (
    <div role="group" aria-label={line.label} className="flex shrink-0 gap-3">
      {line.answers.map((option) => {
        const chosen = answer === option;
        const suggested = !answered && line.policy_suggestion === option;
        return (
          <Button
            key={option}
            size="sm"
            className={cn(
              "min-w-28",
              answered && !chosen ? "border-line-subtle text-ink-muted" : "",
            )}
            aria-pressed={chosen}
            fill={chosen ? "solid" : "outlined"}
            tone={toneFor(chosen, option, suggested)}
            onClick={() => onAnswer(option)}
          >
            {option}
          </Button>
        );
      })}
    </div>
  );
}

/**
 * A CHOSEN NO IS RED AND A CHOSEN YES IS GREEN, because a NO is a disclosure
 * the reviewer downstream has to act on and the row should say so before it is
 * read. Everything unchosen is neutral except the one policy suggested.
 */
function toneFor(
  chosen: boolean,
  option: SignoffAnswer,
  suggested: boolean,
): "halt" | "settled" | "action" | "neutral" {
  if (chosen) return option === "NO" ? "halt" : "settled";
  return suggested ? "action" : "neutral";
}
