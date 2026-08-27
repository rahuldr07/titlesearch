/**
 * THE FIVE NO-VALUE RENDERS, AS DATA.
 *
 * `enums.ts:20-52` names four NA reasons and then says the fifth render —
 * a null value with a null `na_reason` — is "NOT YET EXTRACTED", a statement
 * about the PIPELINE rather than about the document, and NOT a member of the
 * enum. `INVARIANTS:37` and `:45-46` forbid collapsing any of them.
 *
 * A table rather than a `switch` scattered across components, because the thing
 * being enforced is that the five differ IN EVERY CHANNEL at once: sentence,
 * mark, ink, border style, fill. The tokens file says so outright — "colour
 * alone does not carry the distinction and is not asked to: each has a border
 * STYLE and a FILL … that is what survives greyscale and a red-green deficiency
 * both."
 *
 * The sentences are the taxonomy's own words, not invented copy:
 *   NOT_PRESENT        — "structurally absent in this jurisdiction"
 *   NOT_FOUND          — "searched for, and there is nothing of record"
 *   NOT_STATED         — "the document is silent on it"
 *   PRESENT_UNREADABLE — "it is on the page and could not be read"
 *
 * `surfacedForReview` is COPIED from the rulebook, not decided here: NOT_PRESENT
 * is "correct, and NEVER surfaced for review" (enums.ts:32-35). It exists so a
 * screen can read the rulebook's answer instead of re-deriving one, and it never
 * changes what a component renders — an NA row renders identically whoever asks.
 */
import type { NaReason } from "@titlepipe/contract";

export type NoValueRender = "not-extracted" | NaReason;

export type NoValueDescriptor = {
  /** The sentence. Rule 14: absence is typed, never a blank. */
  readonly sentence: string;
  /** Rule 6's glyph vocabulary — a mark, never an icon. */
  readonly mark: string;
  /** Token-backed classes. Distinct ink AND distinct border style AND fill. */
  readonly chrome: string;
  /** Whether this member is surfaced for review. Rulebook, not derivation. */
  readonly surfacedForReview: boolean;
};

export const NO_VALUE: Readonly<Record<NoValueRender, NoValueDescriptor>> = {
  /**
   * Solid stroke, solid fill. Surfacing it "sends reviewers chasing ghosts on
   * every California order", so it is the one member that is never surfaced.
   */
  NOT_PRESENT: {
    sentence: "Not used in this jurisdiction",
    mark: "•",
    chrome:
      "border-solid border-na-not-present-border bg-surface-sunken text-na-not-present-ink",
    surfacedForReview: false,
  },
  /** Same stroke colour, DASHED, empty fill — searched, none of record. */
  NOT_FOUND: {
    sentence: "Searched — nothing of record",
    mark: "◆",
    chrome: "border-dashed border-na-not-found-border bg-transparent text-na-not-found-ink",
    surfacedForReview: true,
  },
  /** The hatch stripe. The search returned a document; the document is silent. */
  NOT_STATED: {
    sentence: "Instrument is silent on it",
    mark: "◆",
    chrome: "tp-na-hatch border-solid border-na-not-found-border text-na-silent-ink",
    surfacedForReview: true,
  },
  /**
   * The only TINTED member, and the only one carrying a page reference
   * (enums.ts:41-43). Attend family: "look at this", not "stopped".
   */
  PRESENT_UNREADABLE: {
    sentence: "On the page — could not be read",
    mark: "◆",
    chrome:
      "border-solid border-na-unreadable-border bg-na-unreadable-surface text-na-unreadable-ink",
    surfacedForReview: true,
  },
  /**
   * NOT an NA reason. A statement about the pipeline, which is why its sentence
   * talks about the run and not about the instrument.
   */
  "not-extracted": {
    sentence: "Not yet extracted",
    mark: "•",
    chrome: "border-dotted border-control-border bg-transparent text-ink-muted",
    surfacedForReview: false,
  },
};
