import type { NaReason } from "@titlepipe/contract";

export type EditorMode = "correct" | "escalate" | "absence" | null;

/**
 * Why a submit is held, as a sentence — the refusal rules of this screen in
 * one place. A correction is refused without its reason and must change
 * something; an escalation without its question; an absence declaration
 * without both the absence and the reason.
 *
 * WHAT ENFORCES THEM, clause by clause. This block used to read "these are the
 * client's courtesy: the enforcement is the contract's and the server's",
 * which is the opposite of the truth for four of the five rules, and a reader
 * would have acted on it — a courtesy is something you may route around.
 *
 *   AN ESCALATION WITHOUT ITS QUESTION is the one clause the old sentence got
 *   right. `EscalateFieldRequest.question` is `z.string().min(1)`
 *   (`packages/contract/src/endpoints.ts`), so the request cannot be built;
 *   `holdFor` really is a courtesy there.
 *
 *   THE FOUR CORRECTION AND ABSENCE CLAUSES HAVE NO ENFORCEMENT BUT THIS
 *   FUNCTION. `CorrectFieldRequest.reason` was relaxed from `min(1)` to
 *   optional on 2026-09-02 (the block above it in `endpoints.ts` carries the
 *   instruction and the date); `value` is `z.string().nullable()`, so `""`
 *   parses; `na_reason` is optional; and "a correction has to differ from the
 *   machine read" was never expressible in a schema at all, because the schema
 *   never sees the machine read. The mock `/correct` handler
 *   (`packages/mocks/src/handlers.ts`) checks none of the four beyond the
 *   schema: it sets `state = "corrected"` and stamps `approved_by`.
 *
 * AND IT GUARDS ONLY ONE OF THE TWO WAYS TO CORRECT A FIELD. `DecisionEditor`
 * (opened with `e`) asks this function. `InlineEdit` (opened by double-click,
 * via `useEditAsk`) never calls it, has no reason box, and posts to the same
 * endpoint. `e2e/invariants/review.spec.ts` drives both, under the PATH A /
 * PATH B titles; `correction-reason.test.ts` is the static tripwire on the
 * relaxation.
 *
 * The last clause of the old sentence stands: when the server refuses anyway,
 * its sentence renders verbatim beside the card. The machine is
 * `useReviewWrites`' `serverNote`, and `e2e/invariants/review-refusals.spec.ts`
 * is what proves it.
 *
 * UNPROVEN RESIDUAL — what a real backend does with any of this. On this
 * branch `services/core-api` mounts `health` and `rules` and no field routes,
 * so there is no server-side correction rule to agree or disagree with. "The
 * server enforces it" was a claim about code that has not been written, which
 * is why it could sit here unnoticed.
 */
export type HoldInput = {
  readonly mode: Exclude<EditorMode, null>;
  readonly pending: boolean;
  readonly value: string;
  readonly machineRead: string;
  readonly reason: string;
  readonly absence: NaReason | null;
};

export function holdFor(at: HoldInput): string | null {
  if (at.pending) return "Filing…";

  if (at.mode === "escalate") {
    return at.reason.trim() === ""
      ? "An escalation is refused without its question."
      : null;
  }

  if (at.mode === "absence") {
    if (at.absence === null) return "Say which of the four absences this is.";
    return at.reason.trim() === ""
      ? "A declared absence is refused without its reason."
      : null;
  }

  if (at.value.trim() === "") {
    return "A correction needs the value it should have been.";
  }
  if (at.value === at.machineRead) {
    return "This is the value the machine read. A correction has to differ from it.";
  }
  return at.reason.trim() === "" ? "A correction is refused without its reason." : null;
}

export const REASON_LABEL: Readonly<Record<Exclude<EditorMode, null>, string>> = {
  correct: "Why",
  escalate: "The question",
  absence: "Why this absence, and what was looked at",
};

export const SUBMIT_LABEL: Readonly<Record<Exclude<EditorMode, null>, string>> = {
  correct: "File the correction",
  escalate: "Escalate",
  absence: "File the absence",
};
