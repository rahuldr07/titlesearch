import { cx } from "../../components/ui";

/**
 * The question, and the refusal to invent one. `asking` and `why` are
 * server-authored and this component has no fallback: a plausible invented
 * question is indistinguishable from an authored one, and a reviewer will
 * act on it. Three states, because they are three statements:
 *
 *   undefined — never routed to review; no question is drawn.
 *   null      — routed, question not written yet; said plainly so a reviewer
 *               knows it is missing rather than thinking they missed it.
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
      {/* 28px — the decision question's size. */}
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
