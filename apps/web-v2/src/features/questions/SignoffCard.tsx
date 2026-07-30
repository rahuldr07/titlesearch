import { useState } from "react";
import type {
  OrderSignoffLine,
  OrderSignoffResponse,
  SignoffAnswer,
} from "@titlepipe/contract";
import { Card, CardFooter, CardHeader } from "../../shared/ui/Card";
import { DividedSection } from "../../shared/ui/ListRow";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Button } from "../../shared/ui/Button";
import { SignoffRow } from "./SignoffRow";

/**
 * The thirteen lines, and the one button that would sign them.
 *
 * LOCAL STATE IS SEEDED FROM THE SERVER'S BASELINE, never invented: a line the
 * server already carries an answer and comment for opens with them, and
 * everything typed after that lives here until a submit endpoint exists. The
 * seed is taken once, on mount, because re-seeding from a refetch would wipe
 * what the person had typed under them.
 *
 * THE ROWS SIT IN A `DividedSection` AND NOTHING ELSE DOES. Each row drops its
 * top hairline when it is `:first-child`, and that exemption is a fact about the
 * DOM rather than about the data: the "Not signed" strip above renders only
 * while nobody has signed, so sharing a parent with it would move the exemption
 * onto the strip the moment an order WAS signed, and the list would open with a
 * hairline hanging off nothing on exactly those orders.
 */
function seedAnswers(lines: readonly OrderSignoffLine[]): Record<string, SignoffAnswer> {
  const seed: Record<string, SignoffAnswer> = {};
  for (const line of lines) {
    if (line.answer !== null) seed[line.line_id] = line.answer;
  }
  return seed;
}

function seedComments(lines: readonly OrderSignoffLine[]): Record<string, string> {
  const seed: Record<string, string> = {};
  for (const line of lines) {
    if (line.comment !== null) seed[line.line_id] = line.comment;
  }
  return seed;
}

export function SignoffCard({ signoff }: { signoff: OrderSignoffResponse }) {
  const lines = signoff.lines;
  const [answers, setAnswers] = useState(() => seedAnswers(lines));
  const [comments, setComments] = useState(() => seedComments(lines));

  const answered = lines.filter((line) => answers[line.line_id] !== undefined).length;
  const remaining = lines.length - answered;
  const ready = lines.every((line) => {
    const answer = answers[line.line_id];
    if (answer === undefined) return false;
    return !(answer === "NO" && line.comment_required && (comments[line.line_id] ?? "").trim() === "");
  });

  /*
   * THE DESIGN'S SENTENCE, WHOLE. The dropped clause — "this signs your work" —
   * is the one that tells the abstractor the press is a SIGNATURE and not a
   * submit, which is the entire point of the screen and of open ruling Q13.
   */
  const startNote = ready
    ? `All ${lines.length} sign-off lines answered — this signs your work and starts the pipeline.`
    : remaining > 0
      ? `${remaining} of ${lines.length} still to answer. All are required to start.`
      : "Every NO needs a comment before you can start.";

  return (
    <>
      <Card accent="action">
        <CardHeader>
          <Eyebrow variant="section" tone="action">
            Abstractor Sign-off
          </Eyebrow>
          <span className="ml-auto text-xs text-ink-muted">
            <span className="font-mono">Y</span>/<span className="font-mono">N</span> answer ·{" "}
            <span className="font-mono">A</span> for N/A · <span className="font-mono">↑↓</span> move
          </span>
        </CardHeader>

        {/*
          NO "NOT SIGNED" BANNER. The design's card goes from its header band
          straight to line 1, and the claim the banner carried — policy can
          suggest, only a person can sign — is stated per row by "◇ NOT ANSWERED
          · Policy suggests YES · only your press signs it", where it applies to
          a line somebody is about to press. As a banner it stated the same fact
          a third time (the strip and the header already say it), and it pushed
          all thirteen rows down by a band on every unsigned order — which is
          every order this card ever draws.
        */}
        <DividedSection>
          {lines.map((line) => (
            <SignoffRow
              key={line.line_id}
              line={line}
              periodLabel={signoff.period_label}
              answer={answers[line.line_id]}
              comment={comments[line.line_id] ?? ""}
              onAnswer={(answer) => setAnswers((prev) => ({ ...prev, [line.line_id]: answer }))}
              onComment={(comment) => setComments((prev) => ({ ...prev, [line.line_id]: comment }))}
            />
          ))}
        </DividedSection>

        <CardFooter className="text-xs font-medium text-ink-secondary">
          {answered} of {lines.length} answered.
        </CardFooter>
      </Card>

      <div className="flex items-center gap-7">
        <p className={ready ? "flex-1 text-sm text-state-settled-ink" : "flex-1 text-sm text-ink-secondary"}>
          {startNote}
        </p>
        {/* CONTRACT GAP: no sign-off submit and no pipeline-start endpoint.
            Drawn as the design draws it and disabled, because signing is an
            append-only server record and this screen cannot make one. The
            reason is on the control itself rather than only in this comment: a
            disabled primary with nothing saying why reads as a bug to the
            person looking at it, and §5's visible-and-disabled affordance is
            only honest if it carries its note. */}
        <Button
          size="lg"
          disabled
          title="No sign-off submit endpoint yet — signing is an append-only server record and this screen cannot make one."
        >
          Start pipeline →
        </Button>
      </div>
    </>
  );
}
