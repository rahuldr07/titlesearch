/**
 * The five no-value renders, as data: the four NA reasons plus
 * "not yet extracted" (a null value with a null na_reason — a statement
 * about the pipeline, not a member of the enum). A table rather than a
 * switch scattered across components, because what is enforced is that the
 * five differ in every channel at once: sentence, mark, ink, border style,
 * fill — which is what survives greyscale and a red-green deficiency.
 *
 * `surfacedForReview` is copied from the rulebook, not decided here — it
 * must stay in sync with the contract's enums. It exists so a screen can
 * read the rulebook's answer instead of re-deriving one, and it never
 * changes what a component renders.
 */
import type { NaReason } from "@titlepipe/contract";

export type NoValueRender = "not-extracted" | NaReason;

export type NoValueDescriptor = {
  /** The sentence. Absence is typed, never a blank. */
  readonly sentence: string;
  /** From the glyph vocabulary — a mark, never an icon. */
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
  /** Same stroke colour, dashed, empty fill — searched, none of record. */
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
   * The only tinted member, and the only one carrying a page reference.
   * Attend family: "look at this", not "stopped".
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
