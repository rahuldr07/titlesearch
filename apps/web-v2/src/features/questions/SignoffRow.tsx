import type { KeyboardEvent } from "react";
import type { OrderSignoffLine, SignoffAnswer } from "@titlepipe/contract";
import { Button } from "../../shared/ui/Button";
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
 * CONTRACT GAP: the wire has no per-line answer set. `SignoffAnswer` is the
 * whole vocabulary, so every line offers all three; the design offered YES/NO
 * only on lines that cannot genuinely fail to apply, and that distinction is
 * not expressible against this schema.
 */
const OPTIONS: readonly SignoffAnswer[] = ["YES", "NO", "N/A"];

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
    const chosen = key === "y" ? "YES" : key === "n" ? "NO" : key === "a" ? "N/A" : null;
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
    <li className="border-t border-line-subtle first:border-t-0">
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
            {OPTIONS.map((option) => {
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
    </li>
  );
}
