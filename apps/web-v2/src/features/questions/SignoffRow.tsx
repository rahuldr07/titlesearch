import type { KeyboardEvent } from "react";
import type { OrderSignoffLine, SignoffAnswer } from "@titlepipe/contract";
import { Button } from "../../shared/ui/Button";
import { ListRow } from "../../shared/ui/ListRow";
import { TextField } from "../../shared/ui/TextField";
import { cn } from "../../shared/ui/classNames";
import { SignoffRowNotes } from "./SignoffRowNotes";

/**
 * One question, one answer, and the reason when the answer is NO.
 *
 * THE ROW IS COLOUR-CODED BY WHAT IT STILL OWES, not by its answer: dashed
 * action edge = nobody has answered this yet; halt edge = a NO is sitting here
 * without the reason it requires; settled edge = done. An abstractor scanning
 * thirteen lines needs to find the unfinished ones without reading them.
 *
 * A NO IS NEVER JUST A NO. The comment field opens with the answer rather than
 * behind a disclosure, because the comment is what a reviewer downstream reads
 * to decide whether the exception is acceptable — a NO with no reason is a
 * disclosure nobody can act on, which is why the server will refuse it.
 *
 * The keys (Y/N/A, arrows) are handled here rather than globally so they only
 * ever apply to the row the person is actually on, and never while they are
 * typing the reason.
 *
 * THE ANSWER SET IS THE LINE'S, NOT THE VOCABULARY'S (2026-07-30, Wave 2).
 * `line.answers` says what THIS line may be answered — six of the thirteen
 * admit N/A, seven do not — so the row draws exactly those buttons and `a` is
 * inert where there is no N/A. Deriving the set here is a second rulebook.
 */
export function SignoffRow({
  line,
  periodLabel,
  answer,
  comment,
  onAnswer,
  onComment,
}: {
  line: OrderSignoffLine;
  periodLabel: string;
  answer: SignoffAnswer | undefined;
  comment: string;
  onAnswer: (answer: SignoffAnswer) => void;
  onComment: (comment: string) => void;
}) {
  const answered = answer !== undefined;
  const commentMissing = answer === "NO" && line.comment_required && comment.trim() === "";

  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement) return;
    const key = event.key.toLowerCase();
    const pressed: SignoffAnswer | null =
      key === "y" ? "YES" : key === "n" ? "NO" : key === "a" ? "N/A" : null;
    // A key may only reach an answer the LINE offers.
    const chosen = pressed !== null && line.answers.includes(pressed) ? pressed : null;
    if (chosen !== null) {
      event.preventDefault();
      onAnswer(chosen);
      return;
    }
    if (key !== "arrowdown" && key !== "arrowup") return;
    const row = event.currentTarget.closest("li");
    const sibling = key === "arrowdown" ? row?.nextElementSibling : row?.previousElementSibling;
    const target = sibling?.querySelector("button");
    if (target instanceof HTMLElement) {
      event.preventDefault();
      target.focus();
    }
  };

  return (
    /*
     * `p-0` MOVES THE PADDING INWARDS, IT DOES NOT DELETE IT — same 16/12, on
     * the tinted element, because the tint is a full-width state band and not a
     * highlight around the text. The tint cannot move out onto the row either:
     * an unanswered line is `border-dashed`, and on the row that style would
     * reach the top hairline, breaking the list's rule into dashes on exactly
     * the lines still owing an answer.
     */
    <ListRow className="p-0">
      {/* Delegation container: the keys belong to the buttons inside it. */}
      <div
        onKeyDown={handleKey}
        className={cn(
          "border-l-(length:--stroke-accent) px-8 py-6",
          answered
            ? commentMissing
              ? "border-l-state-halt bg-state-halt-surface"
              : "border-l-state-settled bg-surface-panel"
            // Dashed on every side is safe: only the left edge has a width.
            : "border-dashed border-l-action bg-action-surface",
        )}
      >
        <div className="flex items-center gap-7">
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-base leading-close",
                answered ? "text-ink-secondary" : "font-semibold text-ink-primary",
              )}
            >
              <span className="mr-3 font-mono text-tiny font-semibold text-ink-muted">
                {line.n}
              </span>
              {line.label}
              <span className="ml-3 text-micro tracking-badge text-ink-muted uppercase">
                {line.group}
              </span>
            </p>
            <SignoffRowNotes line={line} periodLabel={periodLabel} answered={answered} />
          </div>

          <div role="group" aria-label={line.label} className="flex shrink-0 gap-3">
            {line.answers.map((option) => {
              const chosen = answer === option;
              return (
                <Button
                  key={option}
                  size="sm"
                  className="min-w-28"
                  aria-pressed={chosen}
                  fill={chosen ? "solid" : "outlined"}
                  tone={chosen ? (option === "NO" ? "halt" : "settled") : "neutral"}
                  onClick={() => onAnswer(option)}
                >
                  {option}
                </Button>
              );
            })}
          </div>
        </div>

        {answer === "NO" ? (
          <div className="mt-5">
            <TextField
              size="sm"
              emphasis
              tone={commentMissing ? "halt" : "settled"}
              value={comment}
              aria-label={`Why NO on sign-off line ${line.n}?`}
              placeholder="Required comment — why NO?"
              onChange={(event) => onComment(event.target.value)}
            />
          </div>
        ) : null}
      </div>
    </ListRow>
  );
}
