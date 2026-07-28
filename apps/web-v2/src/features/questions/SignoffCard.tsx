import { useState } from "react";
import type {
  OrderSignoffLine,
  OrderSignoffResponse,
  SignoffAnswer,
} from "@titlepipe/contract";
import { Card, CardFooter, CardHeader } from "../../shared/ui/Card";
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
  /**
   * How many lines POLICY has an opinion about — not how many are filled in,
   * which is always none. The banner used to say "some answers are prefilled
   * from client policy" on every order, including orders where no line carries
   * the flag at all, and the screen deliberately prefills nothing. A banner
   * that announces a prefill the rows then refuse to show is the exact
   * suggestion/signature confusion ruling Q13 is open about.
   */
  const suggested = lines.filter((line) => line.prefilled_from_policy).length;
  const ready = lines.every((line) => {
    const answer = answers[line.line_id];
    if (answer === undefined) return false;
    return !(answer === "NO" && line.comment_required && (comments[line.line_id] ?? "").trim() === "");
  });

  const startNote = ready
    ? `All ${lines.length} sign-off lines answered — signing starts the pipeline.`
    : remaining > 0
      ? `${remaining} of ${lines.length} still to answer. All are required to start.`
      : "Every NO needs a comment before you can start.";

  return (
    <>
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

        {signoff.signed_by === null ? (
          <p className="border-b border-line-subtle bg-action-surface px-8 py-4 text-xs leading-body text-action-ink">
            <span className="font-semibold">Not signed.</span>{" "}
            {suggested === 0
              ? null
              : `Client policy has a suggested answer on ${suggested} of these ${lines.length} lines, and none of it is filled in. `}
            Policy can suggest; only a person can sign.
          </p>
        ) : null}

        <ul>
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
        </ul>

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
            append-only server record and this screen cannot make one. */}
        <Button size="lg" disabled>
          Start pipeline →
        </Button>
      </div>
    </>
  );
}
