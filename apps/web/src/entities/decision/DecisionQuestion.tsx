import { cx } from "../../components/ui";

/**
 * THE QUESTION, AND THE REFUSAL TO INVENT ONE.
 *
 * `asking` and `why` are the "only two on this schema written for a person
 * rather than for a machine" (`entities.ts:124-149`), and they are
 * SERVER-AUTHORED — "composing either in the browser would be the UI narrating
 * why the pipeline routed something — a claim only the router can make, and one
 * that would drift from the router the moment either changed."
 *
 * So this component has no fallback. There is no "Is the value correct?" default
 * and no "Two readings disagreed" composed from the readings array: a plausible
 * invented question is worse than a missing one, because it is indistinguishable
 * from an authored one and a reviewer will act on it.
 *
 * ══ THREE STATES, BECAUSE THEY ARE THREE STATEMENTS ═════════════════════════
 *
 * The schema is optional AND nullable, and the file says why: ABSENT on a field
 * that never went to review, `null` on one that did and has no authored question
 * yet. Under `exactOptionalPropertyTypes` a reader gets all three and "must
 * handle all three, because they are three different statements."
 *
 *   undefined — never routed to review. The card leads with the value; there is
 *               no question because nobody is being asked anything.
 *   null      — routed, and the question is not written yet. Said plainly, in
 *               the pipeline's voice, so a reviewer knows it is missing rather
 *               than thinking they missed it.
 *   string    — the authored question, verbatim.
 */
export type DecisionQuestionProps = {
  readonly asking: string | null | undefined;
  readonly why: string | null | undefined;
};

export function DecisionQuestion({ asking, why }: DecisionQuestionProps) {
  if (asking === undefined) return null;

  if (asking === null) {
    return (
      <p
        data-decision-question="unauthored"
        className="font-sans text-meta leading-close text-ink-muted"
      >
        No question has been authored for this decision yet.
      </p>
    );
  }

  return (
    <div data-decision-question="authored" className="flex flex-col gap-3">
      {/* Rule 2: 28px is the decision question's size, per the token file. */}
      <h2 className={cx("font-sans text-title leading-tight text-ink-primary")}>{asking}</h2>
      {/*
        `why` is independently optional. An authored question with no authored
        reason renders as a question with no reason — not as a question with a
        guessed one.
      */}
      {typeof why === "string" && why.length > 0 && (
        <p className="font-sans text-meta leading-close text-ink-secondary">{why}</p>
      )}
    </div>
  );
}
