import type { OrderSignoffLine, SignoffAnswer } from "@titlepipe/contract";
import { Chip } from "../../shared/ui/Chip";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { ListRow } from "../../shared/ui/ListRow";
import { cn } from "../../shared/ui/classNames";
import { SignoffLineNotes } from "./SignoffLineNotes";

/**
 * One sign-off line as a RECORD rather than as a question.
 *
 * RULE: a recorded answer keeps the abstractor's own words beside it. FAILURE
 * PREVENTED: a NO summarised, paraphrased or dropped stops being a disclosure
 * and becomes a blank, and the reviewer downstream inherits a gap nobody named.
 * The comment is quoted verbatim for that reason and for no other.
 *
 * AN UNANSWERED LINE IS DRAWN AS UNFINISHED, not as absent: dashed action edge,
 * the same mark `SignoffRow` uses while a person is still working. Dashed rather
 * than merely pale because the distinction has to survive greyscale — style
 * carries it, colour only repeats it.
 *
 * A NO THAT REQUIRED A COMMENT AND HAS NONE IS SHOWN AS A DEFECT. The refusal is
 * the server's (`min(1)`), so a record that reached the client without one is a
 * fault worth seeing rather than an empty line worth ignoring.
 */
const ANSWER_TONE = {
  YES: "settled",
  NO: "attend",
  "N/A": "neutral",
} as const satisfies Record<SignoffAnswer, "settled" | "attend" | "neutral">;

export interface SignoffLineRowProps {
  line: OrderSignoffLine;
  /**
   * CONTRACT GAP: nothing on `OrderSignoffLine` records that a signed answer was
   * later amended, or what it was amended from. The export draws the badge
   * (`:1057`) off browser state. The prop exists so a call site cannot invent
   * one inline; no endpoint supplies it yet, and the badge is absent until one
   * does rather than reconstructed from a diff the client is not entitled to.
   */
  amendedFrom?: SignoffAnswer | undefined;
  /**
   * CONTRACT GAP: whether this line contradicts what extraction found is the
   * server's verdict, and no field carries it. The export computes it in the
   * browser from a hardcoded line id (`:3208`); that is a rulebook rebuilt in a
   * screen and it is refused here.
   */
  raised?: boolean;
}

export function SignoffLineRow({
  line,
  amendedFrom,
  raised = false,
}: SignoffLineRowProps) {
  const answer = line.answer;
  const commentMissing =
    answer === "NO" && line.comment_required && line.comment === null;

  return (
    <ListRow
      data-testid={`signoff-line-${line.line_id}`}
      className={cn(
        "flex flex-col gap-3 border-l-(length:--stroke-accent)",
        answer === null
          ? "border-dashed border-l-action bg-action-surface"
          : "border-l-transparent",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-5">
        <p className="min-w-0 flex-1 text-sm leading-close text-ink-primary">
          <span className="mr-3 font-mono tnum text-tiny font-semibold text-ink-muted">
            L{String(line.n).padStart(2, "0")}
          </span>
          {line.label}
        </p>

        {answer === null ? (
          <Eyebrow variant="caption" tone="action">
            NOT ANSWERED
          </Eyebrow>
        ) : (
          <Chip tone={ANSWER_TONE[answer]} size="md" shape="mono" bordered>
            {answer}
          </Chip>
        )}
      </div>

      {amendedFrom === undefined || answer === null ? null : (
        <Chip tone="attend" size="sm" bordered className="self-start">
          AMENDED FROM {amendedFrom} → {answer} · RECORDED
        </Chip>
      )}

      {line.comment === null ? null : (
        <p className="border-l-(length:--stroke-accent) border-line-strong pl-5 font-quote text-sm leading-open text-ink-secondary">
          &ldquo;{line.comment}&rdquo;
        </p>
      )}

      {commentMissing ? (
        <p className="text-xs font-semibold text-state-halt-ink">
          NO recorded with no comment
        </p>
      ) : null}

      {raised ? (
        <Chip tone="action" size="sm" bordered className="self-start">
          CONTRADICTS EXTRACTION — RAISED AS A DECISION ABOVE
        </Chip>
      ) : null}

      <SignoffLineNotes line={line} />
    </ListRow>
  );
}
