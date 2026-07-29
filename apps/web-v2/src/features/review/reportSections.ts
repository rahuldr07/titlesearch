import type { Field } from "@titlepipe/contract";

/**
 * A field the pipeline ever sent to a person — pending or already decided.
 * Shared by `DecisionDock` (the meter) and `FinalizeBar` (the gate) so the two
 * surfaces count the exact same set of fields; each used to redeclare this
 * verbatim.
 */
export const DECISION_STATES = new Set<Field["state"]>([
  "needs_review",
  "confirmed",
  "corrected",
  "escalated",
]);

/** Section order follows the delivered document, not the payload order. */
export const SECTION_HEADING: Record<string, string> = {
  owner: "Vesting & owner",
  legal: "Legal description",
  deed: "Vesting deed",
  mortgages: "Mortgages & deeds of trust",
  judgments: "Judgments & liens",
  assessment: "Assessment & taxes",
};

/**
 * THE ONE GROUPING FUNCTION. `CallBackSheet` (the draft report) and
 * `SectionRail` (the jump nav beside it) must walk the SAME sections in the
 * SAME order — a rail that offers "Judgments" when the sheet renders it under
 * a differently-derived key is a broken link wearing a working label. Both
 * import this instead of each re-deriving the split from `field.path`.
 */
export function sectionsOf(fields: readonly Field[]): [string, Field[]][] {
  const groups = new Map<string, Field[]>();
  for (const field of fields) {
    const section = field.path.split(".")[0] ?? "other";
    groups.set(section, [...(groups.get(section) ?? []), field]);
  }
  return [...groups.entries()];
}

/**
 * How many fields in this group still need a person — `needs_review`, or sent
 * up and not yet resolved (`escalated`). Used for the rail's per-section badge
 * so a reviewer can see WHERE the open decisions are before jumping, not just
 * that some exist. `auto_confirmed` and settled states are deliberately absent
 * from this count: nobody is waiting on those.
 */
export function needsYouCountOf(fields: readonly Field[]): number {
  return fields.filter((f) => f.state === "needs_review" || f.state === "escalated").length;
}

/** The anchor id a section's container renders, and the href a rail link points at. */
export function sectionAnchor(section: string): string {
  return `section-${section}`;
}
