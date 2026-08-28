import type { NoValueRender } from "../../entities/field/noValueStates";

/**
 * THE GUIDE'S PROSE, AND THE LINE IT COMES FROM.
 *
 * Principle 6: never emit a value you cannot cite. A taxonomy guide is the last
 * place to break that, so every row carries the `enums.ts` line its sentence is
 * a paraphrase of, and the guide prints the citation next to the text.
 *
 * The SENTENCE and the chip are NOT here — they come from
 * `entities/field/noValueStates.ts`, which every screen already renders from.
 * Two copies of the taxonomy's words is how the five renders drift back into
 * one grey dash; this file adds only the "when does it apply" paragraph the
 * chip has no room for.
 *
 * Typed as an exhaustive `Record`, so adding a member to `NaReason` without
 * giving it guide copy is a compile error rather than a hole on screen.
 */
export interface NaGuideRow {
  /** Why the document is in this state. Paraphrases the cited line, closely. */
  readonly when: string;
  /** Where the rule lives. Printed, not merely referenced. */
  readonly cite: string;
}

export const NA_GUIDE: Readonly<Record<NoValueRender, NaGuideRow>> = {
  NOT_PRESENT: {
    when: "The field does not exist in this jurisdiction at all — San Diego book and page, Houston instrument number, Greene building value. Correct, not missing, and never surfaced for review: surfacing it sends reviewers chasing ghosts on every California order.",
    cite: "contract/src/enums.ts:31-34",
  },
  NOT_FOUND: {
    when: "The field exists in this jurisdiction and was searched for, and there is nothing of record — McIntosh consideration, Mecklenburg plaintiff attorney. Always surfaced.",
    cite: "contract/src/enums.ts:35-37",
  },
  NOT_STATED: {
    when: "The document is silent on it. Distinct from searched-and-nothing-of-record: the search happened and returned a document, and the document does not say.",
    cite: "contract/src/enums.ts:38-39",
  },
  PRESENT_UNREADABLE: {
    when: "It is on the page and could not be read — degraded scan, microfilm density loss. The honest answer, always surfaced, and the only state that carries a page reference.",
    cite: "contract/src/enums.ts:40-42",
  },
  "not-extracted": {
    when: "A null value with no NA reason at all. This is a statement about the pipeline, not about the document, so it is not a member of the enum and must never be collapsed into one. Nothing is ever keyed off a null value alone.",
    cite: "contract/src/enums.ts:44-47",
  },
};

/** The enum members, in the order the rulebook lists them. */
export const NA_REASONS: readonly NoValueRender[] = [
  "NOT_PRESENT",
  "NOT_FOUND",
  "NOT_STATED",
  "PRESENT_UNREADABLE",
];
