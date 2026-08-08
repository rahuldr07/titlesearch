import type { Field } from "@titlepipe/contract";
import { isExcluded } from "../../entities/field/fieldLabel";

/**
 * ANSWERED IS EVERY STATE A PERSON PUT THE FIELD INTO — an exclusion included,
 * because an excluded field has left the queue by a decision. `needs_review` is
 * the only thing still owed. The server's `state` is the whole input; nothing
 * here consults confidence.
 */
export function isAnswered(field: Field): boolean {
  return isExcluded(field) || field.state !== "needs_review";
}

export type SegmentTone = "pending" | "answered" | "current";

/**
 * RULE: the meter is a POSITION, not a scorecard — answered ink, the open
 * decision at full ink, what is left in the track colour. The mockup's three
 * fills are `ink-secondary`, `ink-primary` and `line-strong` to the letter.
 *
 * FAILURE PREVENTED: the band painted one of FOUR state colours per segment —
 * settled green, action red, attend amber — so a worked order rendered as a row
 * of green bars and the screen's one accent was spent eleven times before
 * Confirm asked for it. And colour was its only carrier: green and amber at 4px
 * are one grey in a photocopy. The outcome per field is on the row that shows
 * the field (`DecisionRow`'s dot) and in the finalize gate's sentence; a 4px
 * segment carries "done / here / not yet", and its three fills differ in
 * LUMINANCE, so the bar survives greyscale.
 */
export const SEGMENT_CLASS: Record<SegmentTone, string> = {
  pending: "bg-line-strong",
  answered: "bg-ink-secondary",
  current: "bg-ink-primary",
};

export function segmentTone(
  field: Field,
  selectedPath: string | undefined,
): SegmentTone {
  return field.path === selectedPath
    ? "current"
    : isAnswered(field)
      ? "answered"
      : "pending";
}
