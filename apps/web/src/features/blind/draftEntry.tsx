import type { BlindConfidence, BlindEntryInput, NaReason } from "@titlepipe/contract";

/**
 * ONE ROW OF THE SEAT'S FORM, AND WHY IT IS NOT `BlindEntryInput` ITSELF.
 *
 * `BlindEntryInput` (entities.ts:289-296) is the three-part contract — value +
 * source + confidence — and it is what goes on the wire. A half-typed row is
 * not that shape yet, and the two differences are the point of this file:
 *
 *   - `absence` is separate from `value` because a null value with a null
 *     `na_reason` MEANS SOMETHING ELSE (enums.ts:44-47): "not yet extracted", a
 *     statement about the pipeline rather than the document, and never an NA
 *     state. A typist has to SAY which absence it is, so the form keeps the two
 *     apart until `toWire` puts them together.
 *   - `confidence` starts `null`, not `"certain"`. HANDOFF §4 / enums.ts:66-70:
 *     "'unclear with source' is legitimate; a confident guess is the poison." A
 *     control defaulted to `certain` answers the one question the three-part
 *     contract exists to ask, on behalf of somebody who has not looked.
 *
 * `key` never leaves the browser. It is React's list identity and nothing else;
 * the server issues the real ids (`entry_ids`, endpoints.ts:304).
 */
export interface DraftEntry {
  readonly key: string;
  readonly path: string;
  readonly value: string;
  readonly absence: NaReason | null;
  readonly citation: string;
  readonly confidence: BlindConfidence | null;
}

/** A counter, because `Date.now()` is a banned date construction (§8). */
let issued = 0;

export function blankEntry(): DraftEntry {
  issued += 1;
  return {
    key: `draft-${String(issued)}`,
    path: "",
    value: "",
    absence: null,
    citation: "",
    confidence: null,
  };
}

/**
 * THE FOUR NO-VALUE STATES, IN THE TYPIST'S WORDS. Rule 14 and enums.ts:30-42:
 * they are statements about the DOCUMENT, they route differently downstream,
 * and "they must never collapse into one grey dash." The gloss beside each is
 * what tells a temp which one they are looking at — the enum member alone does
 * not distinguish NOT_FOUND from NOT_STATED, and that pair is the one people
 * get wrong.
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
 * The draft as the contract wants it. Absence and value are exclusive here.
 *
 * THE PATH AND THE CITATION ARE TRIMMED; THE VALUE IS NOT. The first two are
 * identifiers — a trailing space in a field path is a different key and a
 * different bucket downstream, which is a transcription accident rather than a
 * reading. The value is the RECORD BEING MADE and is sent exactly as keyed:
 * this is a measurement of what a human typed off a page, and a client that
 * tidied it would be editing the thing being measured.
 */
export function toWire(draft: DraftEntry, confidence: BlindConfidence): BlindEntryInput {
  const base = { path: draft.path.trim(), source_citation: draft.citation.trim(), confidence };
  return draft.absence === null
    ? { ...base, value: draft.value }
    : { ...base, value: null, na_reason: draft.absence };
}

/**
 * WHY THE SUBMIT IS HELD, A SENTENCE PER CAUSE — the convention `holdReason`
 * in `features/escalations` set, and `disabled.ts`'s inverted one: a reason IS
 * the disablement, and `null` is the only thing that enables a control.
 *
 * EVERY CLAUSE HERE IS A SCHEMA CLAUSE, and that is the whole licence for
 * holding at all. `entries` is `.min(1)`, `source_citation` is
 * `.min(1)` (entities.ts:293 / endpoints.ts:301), and `confidence` is a
 * required enum. Nothing else is checked: `features/ingest/OrderFields` records
 * the rule this file is the narrow exception to — the SERVER names what is
 * missing (INVARIANT 15) and a second client-side list would drift from it.
 * These three do not drift, because the request does not exist without them.
 */
export function holdReason(drafts: readonly DraftEntry[]): string | null {
  if (drafts.length === 0) {
    return "Held: there is nothing to file — add a field first.";
  }
  if (drafts.some((draft) => draft.path.trim().length === 0)) {
    return "Held: every entry names the field it is an entry for.";
  }
  if (drafts.some((draft) => draft.citation.trim().length === 0)) {
    return "Held: a value with no source is a guess — cite the page it came off.";
  }
  if (drafts.some((draft) => draft.confidence === null)) {
    return "Held: say how sure you are. Unclear is an answer; silence is not.";
  }
  if (drafts.some((draft) => draft.absence === null && draft.value.trim().length === 0)) {
    return "Held: an empty box is not an absence — say which of the four it is.";
  }
  return null;
}
