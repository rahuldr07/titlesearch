import type {
  BlindConfidence,
  BlindEntryInput,
  NaReason,
  SheetSection,
} from "@titlepipe/contract";

/**
 * One row of the sheet. `absence` stays separate from `value` because a
 * null value with a null `na_reason` means "not yet extracted" — a pipeline
 * statement, never an NA state. `confidence` starts null, not "certain": a
 * control defaulted to certain answers the question the three-part contract
 * exists to ask.
 */
export interface DraftEntry {
  readonly path: string;
  readonly value: string;
  readonly absence: NaReason | null;
  readonly citation: string;
  readonly confidence: BlindConfidence | null;
}

export type DraftSheet = Readonly<Record<string, DraftEntry>>;

export function blankSheet(sections: readonly SheetSection[]): DraftSheet {
  const sheet: Record<string, DraftEntry> = {};
  for (const section of sections) {
    for (const field of section.fields) {
      sheet[field.path] = {
        path: field.path,
        value: "",
        absence: null,
        citation: "",
        confidence: null,
      };
    }
  }
  return sheet;
}

/** A row the typist has actually answered — a reading, or one of the four absences. */
export function isAnswered(draft: DraftEntry): boolean {
  return draft.absence !== null || draft.value.trim().length > 0;
}

/**
 * The four no-value states, in the typist's words. They are statements
 * about the document and route differently downstream, so they never
 * collapse into one grey dash.
 */
export const ABSENCES: readonly { readonly id: NaReason; readonly gloss: string }[] = [
  { id: "NOT_PRESENT", gloss: "Not present — this county does not use this field at all" },
  { id: "NOT_FOUND", gloss: "Not found — searched the package, nothing of record" },
  { id: "NOT_STATED", gloss: "Not stated — the document is there and is silent on it" },
  { id: "PRESENT_UNREADABLE", gloss: "Present, unreadable — on the page, could not be read" },
];

export const CONFIDENCES: readonly { readonly id: BlindConfidence; readonly gloss: string }[] = [
  { id: "certain", gloss: "Certain — read it plainly" },
  { id: "probable", gloss: "Probable — read it, would not swear to a character" },
  { id: "unclear", gloss: "Unclear — say so rather than guess" },
];

/**
 * The draft as the contract wants it. The citation is trimmed because it is an
 * identifier; the value is sent exactly as keyed, because it is the record
 * being made and a client that tidied it would edit the thing being measured.
 */
export function toWire(draft: DraftEntry, confidence: BlindConfidence): BlindEntryInput {
  const base = { path: draft.path, source_citation: draft.citation.trim(), confidence };
  return draft.absence === null
    ? { ...base, value: draft.value }
    : { ...base, value: null, na_reason: draft.absence };
}

/**
 * Why the submit is held, a sentence per cause — `null` is the only thing that
 * enables the control. Every clause is a schema clause (entries `.min(1)`,
 * `source_citation` `.min(1)`, `confidence` a required enum), plus the
 * schedule's own `required` mark; the server still names anything else.
 */
export function holdReason(
  answered: readonly DraftEntry[],
  missingRequired: readonly string[],
): string | null {
  if (answered.length === 0) {
    return "Held: nothing has been keyed yet — read a field off the package first.";
  }
  if (missingRequired.length > 0) {
    return `Held: ${String(missingRequired.length)} required field(s) unanswered — ${missingRequired.join(", ")}.`;
  }
  if (answered.some((draft) => draft.citation.trim().length === 0)) {
    return "Held: a value with no source is a guess — cite the page it came off.";
  }
  if (answered.some((draft) => draft.confidence === null)) {
    return "Held: say how sure you are. Unclear is an answer; silence is not.";
  }
  return null;
}
