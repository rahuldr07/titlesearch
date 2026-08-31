import type { NaReason } from "@titlepipe/contract";
import type { EditorMode } from "./DecisionEditor";

/**
 * Why a submit is held, as a sentence — the refusal rules of this screen in
 * one place. A correction is refused without its reason and must change
 * something; an escalation without its question; an absence declaration
 * without both the absence and the reason. These are the client's courtesy:
 * the enforcement is the contract's and the server's, and when the server
 * refuses anyway its sentence renders verbatim beside the card.
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
