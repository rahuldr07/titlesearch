import type { NaReason } from "@titlepipe/contract";
import type { EditorMode } from "./DecisionEditor";

/**
 * WHY A SUBMIT IS HELD, AS A SENTENCE — the refusal rules of this screen in one
 * place, split out of `DecisionEditor` for §6's length gate.
 *
 * INVARIANT 9 — a correction is refused without its reason.
 * INVARIANT 10 — an escalation is refused without its question.
 * §11.1 — a correction must CHANGE something; filing the machine's own reading
 * back at it records a correction that corrected nothing.
 * A Law 3 declaration is a correction on the wire, so it is refused without
 * both the absence and the reason.
 *
 * These are the CLIENT's courtesy. The enforcement is the contract's
 * (`CorrectFieldRequest.reason` is `z.string().min(1)`) and the server's, and
 * when the server refuses anyway its sentence is rendered verbatim beside the
 * card (INVARIANT 14). Nothing here duplicates a server rule as a gate.
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
