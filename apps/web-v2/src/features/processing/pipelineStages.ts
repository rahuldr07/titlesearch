/**
 * The run, as eight stages with two halts in it.
 *
 * WHY BOTH RENDERINGS ARE FIXTURES, NOT DERIVED: the stage a run is on, and
 * whether the completeness gate passed, are server state. This module holds the
 * design's copy for each of the two outcomes side by side and lets the screen
 * pick one — it never computes a phase from anything. The moment a screen
 * infers "extraction must be done by now", it has become a second, wrong copy
 * of the pipeline's state machine.
 *
 * CONTRACT GAP: no pipeline-stage endpoint. `packages/contract` has no run,
 * stage or gate resource at all, so there is nothing to read the real phases,
 * substitutes or page counts from. Everything below is a placeholder.
 */

export type StagePhase =
  /** finished */
  | "done"
  /** stopped by the completeness gate — actionable, and pulsing */
  | "halted"
  /** the run is waiting on a person, which is not a failure */
  | "awaiting-you"
  /** cannot start until something upstream clears */
  | "held";

export type StageOwner = "Automated" | "LLM agent" | "You";

interface StageState {
  readonly sub: string;
  readonly phase: StagePhase;
}

export interface PipelineStage {
  readonly title: string;
  /**
   * Who did it. Shown on every row because "an agent read this" and "a machine
   * did this" carry different amounts of trust, and a reader who cannot tell
   * them apart will over-trust one and under-trust the other.
   */
  readonly owner: StageOwner;
  readonly halted: StageState;
  readonly passed: StageState;
}

export const PACKAGE_PAGES = 64;
export const PAGES_READ_IN_FULL = 11;

export const CLASSIFIER_NOTE =
  "The classifier found nothing the report needs on the other pages. You review 11.";

export const PIPELINE_STAGES: readonly PipelineStage[] = [
  {
    title: "Ingest & pre-process",
    owner: "Automated",
    halted: { sub: `Deskew, de-speckle, OCR · ${PACKAGE_PAGES} pages`, phase: "done" },
    passed: { sub: `Deskew, de-speckle, OCR · ${PACKAGE_PAGES} pages`, phase: "done" },
  },
  {
    title: "Classify & segment",
    owner: "LLM agent",
    halted: { sub: "Two independent readers · 11 pages carried forward", phase: "done" },
    passed: { sub: "Two independent readers · 11 pages carried forward", phase: "done" },
  },
  {
    title: "Completeness gate — checks the package against your sign-off",
    owner: "Automated",
    halted: { sub: "Halted — the package contradicts your intake claims.", phase: "halted" },
    passed: { sub: "Passed — the package supports every claim.", phase: "done" },
  },
  {
    title: "Extract fields",
    owner: "LLM agent",
    halted: { sub: "Held — an incomplete package never reaches extraction.", phase: "held" },
    passed: { sub: "Values pulled with page-line provenance", phase: "done" },
  },
  {
    title: "Assemble draft",
    owner: "Automated",
    halted: { sub: "Mapped into the Call Back Sheet sections", phase: "held" },
    passed: { sub: "Mapped into the Call Back Sheet sections", phase: "done" },
  },
  {
    title: "Validate & flag",
    owner: "LLM agent",
    halted: { sub: "Reader agreement checked · disagreements flagged", phase: "held" },
    passed: { sub: "Reader agreement checked · disagreements flagged", phase: "done" },
  },
  {
    title: "Human QC gate — the run stops here for you",
    owner: "You",
    halted: { sub: "Waits until the completeness gate passes.", phase: "held" },
    passed: {
      sub: "Waiting on you. Nothing is delivered until you approve every flag.",
      phase: "awaiting-you",
    },
  },
  {
    title: "Finalize & deliver",
    owner: "Automated",
    halted: { sub: "Render Word deliverable, embed citation images", phase: "held" },
    passed: { sub: "Render Word deliverable, embed citation images", phase: "held" },
  },
];
