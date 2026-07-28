import { useState } from "react";
import { ScreenTitle } from "../../app/ScreenTitle";
import { Card, CardFooter, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Button } from "../../shared/ui/Button";
import { OrderIdentityStrip } from "./OrderIdentityStrip";
import { SignoffRow } from "./SignoffRow";
import { SIGNOFF_LINES, type SignoffAnswer } from "./signoffLines";
import {
  CLIENT_DIFF_NOTE,
  POLICY_PREFILL_HEADLINE,
  POLICY_PREFILL_NOTE,
} from "./orderContext";

/**
 * STEP 2 — the abstractor claims their own work, before the pipeline runs.
 *
 * This is not QC. The reviewer downstream vouches for the report; this screen
 * is the person who did the search saying what they did, at the moment they
 * hand it over. Moving it after the pipeline would turn every answer into a
 * memory of work done days ago, and a NO into an accusation rather than a
 * disclosure.
 *
 * NOTHING IS PREFILLED HERE. Policy suggestions are shown beside each
 * unanswered line and still cost a press. Whether policy may prefill at all is
 * OPEN RULING Q13; the design's own words — policy can suggest, only a person
 * can sign — are rendered verbatim so the distinction survives either ruling.
 *
 * CONTRACT GAP: no sign-off submit endpoint, and no pipeline-start endpoint.
 * Answers, their required comments and the signature live only in this
 * component's state; "Start pipeline" therefore has nothing to call, and is
 * rendered enabled/disabled per the design rather than wired to a mutation.
 */
export function QuestionsScreen() {
  const [answers, setAnswers] = useState<Record<string, SignoffAnswer>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

  const answered = SIGNOFF_LINES.filter((line) => answers[line.id] !== undefined).length;
  const remaining = SIGNOFF_LINES.length - answered;
  const ready = SIGNOFF_LINES.every((line) => {
    const answer = answers[line.id];
    if (answer === undefined) return false;
    return !(answer === "NO" && line.commentOnNo === "required" && (comments[line.id] ?? "").trim() === "");
  });

  const startNote = ready
    ? `All ${SIGNOFF_LINES.length} sign-off lines answered — this signs your work and starts the pipeline.`
    : remaining > 0
      ? `${remaining} of ${SIGNOFF_LINES.length} still to answer. All are required to start.`
      : "Every NO needs a comment before you can start.";

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-3">
        <ScreenTitle>Step 2 — Sign-off</ScreenTitle>
        <h1 className="text-4xl font-semibold">Confirm what you did on this search</h1>
        <p className="max-w-2xl text-md leading-body text-ink-secondary">
          You answer these before the pipeline runs — this is you claiming your
          own work at the moment you hand it over, not the QC reviewer vouching
          for it later. All required. Suggested answers come from this client&apos;s
          reviewed policy; you still answer each line.
        </p>
      </header>

      <OrderIdentityStrip />

      <p className="rounded-8 border border-state-attend-border bg-state-attend-surface px-6 py-5 text-sm leading-body text-state-attend-ink">
        ◆ {CLIENT_DIFF_NOTE}
      </p>

      <Card className="border-t-(length:--stroke-accent) border-t-action">
        <CardHeader>
          <Eyebrow variant="section" tone="action">
            Abstractor Sign-off
          </Eyebrow>
          <span className="ml-auto text-xs text-ink-muted">
            <span className="font-mono">Y</span>/<span className="font-mono">N</span> answer ·{" "}
            <span className="font-mono">A</span> for N/A · <span className="font-mono">↑↓</span> move
          </span>
        </CardHeader>

        <p className="border-b border-line-subtle bg-action-surface px-8 py-5 text-xs leading-body text-action-ink">
          <span className="font-semibold">{POLICY_PREFILL_HEADLINE}</span>{" "}
          {POLICY_PREFILL_NOTE}
        </p>

        <ul>
          {SIGNOFF_LINES.map((line) => (
            <SignoffRow
              key={line.id}
              line={line}
              answer={answers[line.id]}
              comment={comments[line.id] ?? ""}
              onAnswer={(answer) => setAnswers((prev) => ({ ...prev, [line.id]: answer }))}
              onComment={(comment) => setComments((prev) => ({ ...prev, [line.id]: comment }))}
            />
          ))}
        </ul>

        <CardFooter className="text-xs font-medium text-ink-secondary">
          {answered} of {SIGNOFF_LINES.length} answered.
        </CardFooter>
      </Card>

      <div className="flex items-center gap-7">
        <p className={ready ? "flex-1 text-sm text-state-settled-ink" : "flex-1 text-sm text-ink-secondary"}>
          {startNote}
        </p>
        <Button size="lg" disabled={!ready}>
          Start pipeline →
        </Button>
      </div>
    </div>
  );
}
